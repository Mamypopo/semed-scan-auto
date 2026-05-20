import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";
import { ENV } from "../config/env.js";
import { generateSasUrl } from "../config/blob.js";

/**
 * Register new user
 * @param {Object} userData - User registration data
 * @returns {Object} Created user data (without password)
 */
export const registerUser = async (userData) => {
  const { name, email, password, registrationCode, role = "GUEST" } = userData;

  // Validate registration code
  if (!registrationCode) {
    throw new Error("กรุณากรอกรหัสสมัครสมาชิก");
  }

  if (registrationCode !== ENV.REGISTRATION_CODE) {
    throw new Error("รหัสสมัครสมาชิกไม่ถูกต้อง");
  }

  const roleCode = (role && typeof role === "string") ? role.toUpperCase() : "GUEST";
  const roleRecord = await prisma.role.findUnique({ where: { code: roleCode } });
  const roleId = roleRecord?.id ?? null;

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new Error("อีเมลนี้ถูกใช้งานแล้ว");
  }

  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      roleId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      roleId: true,
      canAccessCheckup: true,
      canAccessClinic: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    }
  });

  return { ...newUser, role: roleRecord?.code ?? "GUEST" };
};

/**
 * Login user
 * @param {Object} credentials - Login credentials
 * @returns {Object} User data and JWT token
 */
export const loginUser = async (credentials) => {
  const { email, password, rememberMe } = credentials;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      nickname: true,
      email: true,
      password: true,
      roleId: true,
      roleRef: {
        select: {
          id: true,
          code: true,
          name: true,
          rolePermissions: {
            select: { permission: { select: { key: true } } }
          }
        }
      },
      defaultCNGroupId: true,
      isGlobalPartTime: true,
      canAccessCheckup: true,
      canAccessClinic: true,
      allowedCompanies: true,
      isActive: true,
      expiredAt: true,
      lastLoginAt: true,
      profileImage: true,
      signatureName: true,
      medicalLicenseNo: true,
      doctorPosition: true,
    }
  });

  if (!user) {
    throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  }

  if (!user.isActive) {
    throw new Error("บัญชีนี้ถูกปิดใช้งาน");
  }

  // เช็ควันหมดอายุ (สำหรับ PARTTIME และ CUSTOMER)
  if (user.expiredAt) {
    const now = new Date();
    const expiredDate = new Date(user.expiredAt);
    if (now > expiredDate) {
      throw new Error("บัญชีนี้หมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบ");
    }
  }

  // Verify password
  if (!user.password) {
    throw new Error("บัญชีนี้ใช้การเข้าสู่ระบบด้วย Microsoft กรุณากดปุ่ม \"เข้าสู่ระบบด้วย Microsoft\"");
  }
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const roleCode = user.roleRef?.code ?? "GUEST";
  const tokenExpiration = rememberMe ? ENV.JWT_REMEMBER_EXPIRES_IN : ENV.JWT_EXPIRES_IN;
  const token = jwt.sign(
    { id: user.id, userId: user.id, email: user.email, role: roleCode },
    ENV.JWT_SECRET,
    { expiresIn: tokenExpiration }
  );

  const { password: _, ...userWithoutPassword } = user;
  const permissions = user.roleRef?.rolePermissions?.map((rp) => rp.permission.key) ?? [];

  let profileImageUrl = null
  if (user.profileImage) {
    const sasResult = await generateSasUrl(user.profileImage, 24)
    profileImageUrl = sasResult?.url || null
  }

  return {
    user: { ...userWithoutPassword, role: roleCode, permissions, profileImage: profileImageUrl },
    token
  };
};

const USER_SELECT = {
  id: true,
  name: true,
  nickname: true,
  email: true,
  roleId: true,
  roleRef: {
    select: {
      id: true,
      code: true,
      name: true,
      rolePermissions: {
        select: { permission: { select: { key: true } } }
      }
    }
  },
  defaultCNGroupId: true,
  isGlobalPartTime: true,
  canAccessCheckup: true,
  canAccessClinic: true,
  allowedCompanies: true,
  isActive: true,
  expiredAt: true,
  lastLoginAt: true,
  profileImage: true,
  signatureName: true,
  medicalLicenseNo: true,
  doctorPosition: true,
};

/**
 * Login with Microsoft SSO
 * @param {Object} msUser - { microsoftId, email, name }
 * @returns {Object} User data and JWT token
 */
export const loginWithMicrosoft = async ({ microsoftId, email, name }) => {
  console.log("[Microsoft SSO] microsoftId:", microsoftId, "email:", email);
  let user = await prisma.user.findUnique({ where: { microsoftId }, select: USER_SELECT });

  // ถ้าไม่เจอจาก microsoftId → หาจาก microsoftEmail ที่ admin ตั้งไว้ แล้ว auto-link
  if (!user && email) {
    const found = await prisma.user.findUnique({ where: { microsoftEmail: email }, select: { id: true } });
    if (found) {
      await prisma.user.update({ where: { id: found.id }, data: { microsoftId } });
      user = await prisma.user.findUnique({ where: { id: found.id }, select: USER_SELECT });
    }
  }

  // ถ้าไม่เจอเลย → สร้าง user ใหม่อัตโนมัติด้วย role GUEST
  if (!user) {
    const guestRole = await prisma.role.findUnique({ where: { code: "GUEST" } });
    const created = await prisma.user.create({
      data: {
        name: name || email.split("@")[0],
        email,
        microsoftId,
        microsoftEmail: email,
        roleId: guestRole?.id ?? null,
      },
    });
    user = await prisma.user.findUnique({ where: { id: created.id }, select: USER_SELECT });
  }

  if (!user.isActive) {
    throw new Error("บัญชีนี้ถูกปิดใช้งาน");
  }

  if (user.expiredAt) {
    const now = new Date();
    if (now > new Date(user.expiredAt)) {
      throw new Error("บัญชีนี้หมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบ");
    }
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const roleCode = user.roleRef?.code ?? "GUEST";
  const token = jwt.sign(
    { id: user.id, userId: user.id, email: user.email, role: roleCode },
    ENV.JWT_SECRET,
    { expiresIn: ENV.JWT_EXPIRES_IN }
  );

  const permissions = user.roleRef?.rolePermissions?.map((rp) => rp.permission.key) ?? [];

  let profileImageUrl = null;
  if (user.profileImage) {
    const sasResult = await generateSasUrl(user.profileImage, 24);
    profileImageUrl = sasResult?.url || null;
  }

  const { password: _pw, ...userWithoutPassword } = user;
  return {
    user: { ...userWithoutPassword, role: roleCode, permissions, profileImage: profileImageUrl },
    token,
  };
};

/**
 * Get user profile
 * @param {Number} userId - User ID
 * @returns {Object} User profile data
 */
export const getUserProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      nickname: true,
      email: true,
      roleId: true,
      roleRef: {
        select: {
          id: true,
          code: true,
          name: true,
          rolePermissions: {
            select: { permission: { select: { key: true } } }
          }
        }
      },
      defaultCNGroupId: true,
      isGlobalPartTime: true,
      canAccessCheckup: true,
      canAccessClinic: true,
      isActive: true,
      expiredAt: true,
      createdAt: true,
      updatedAt: true,
      profileImage: true,
      signatureName: true,
      medicalLicenseNo: true,
      doctorPosition: true,
    }
  });

  if (!user) {
    throw new Error("ไม่พบผู้ใช้");
  }

  if (!user.isActive) {
    throw new Error("บัญชีนี้ถูกปิดใช้งาน");
  }

  // เช็ควันหมดอายุ (สำหรับ PARTTIME และ CUSTOMER)
  if (user.expiredAt) {
    const now = new Date();
    const expiredDate = new Date(user.expiredAt);
    if (now > expiredDate) {
      throw new Error("บัญชีนี้หมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบ");
    }
  }

  const permissions = user.roleRef?.rolePermissions?.map((rp) => rp.permission.key) ?? [];
  const role = user.roleRef?.code ?? "GUEST";

  let profileImageUrl = null
  if (user.profileImage) {
    const sasResult = await generateSasUrl(user.profileImage, 24)
    profileImageUrl = sasResult?.url || null
  }

  return { ...user, role, permissions, profileImage: profileImageUrl };
}
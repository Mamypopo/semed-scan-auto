import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";
import { ENV } from "../config/env.js";

export const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: "ไม่พบ Token การเข้าสู่ระบบ" });
    }

    jwt.verify(token, ENV.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ success: false, message: "Token ไม่ถูกต้องหรือหมดอายุ" });
      }
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์" });
  }
};

/**
 * โหลด permissions และ roles ของ user จาก DB ลง req.user (ใช้ก่อน requirePermission)
 */
export const loadUserPermissions = async (req, res, next) => {
  try {
    if (!req.user?.id) return next();
    if (req.user.permissions) return next();

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        userRoles: {
          select: {
            role: {
              select: {
                code: true,
                rolePermissions: {
                  select: { permission: { select: { key: true } } }
                }
              }
            }
          }
        }
      }
    });

    req.user.roles = user?.userRoles?.map(ur => ur.role.code) ?? [];
    req.user.permissions = [
      ...new Set(user?.userRoles?.flatMap(ur => ur.role.rolePermissions.map(rp => rp.permission.key)) ?? [])
    ];
    next();
  } catch (err) {
    console.error("loadUserPermissions error:", err);
    return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการโหลดสิทธิ์" });
  }
};

/**
 * RBAC: ต้องมี permission อย่างน้อยหนึ่งในรายการ
 */
export const requirePermission = (permissions) => {
  const list = Array.isArray(permissions) ? permissions : [permissions];
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: "ไม่พบข้อมูลผู้ใช้" });
      }
      await loadUserPermissions(req, res, () => {});
      const userPerms = req.user.permissions ?? [];
      const has = list.some(p => userPerms.includes(p));
      if (!has) {
        return res.status(403).json({ success: false, message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้" });
      }
      next();
    } catch (err) {
      console.error("requirePermission error:", err);
      return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์" });
    }
  };
};

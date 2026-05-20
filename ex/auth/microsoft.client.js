import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";

const AUTH_BASE = `https://login.microsoftonline.com/${ENV.MICROSOFT_TENANT_ID}/oauth2/v2.0`;
const GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me";

// ใช้ JWT-signed state แทน in-memory Map
// → รองรับ multi-instance และ restart โดยไม่ต้องพึ่ง memory

export const getMicrosoftAuthUrl = () => {
  const state = jwt.sign(
    { nonce: crypto.randomUUID() },
    ENV.JWT_SECRET,
    { expiresIn: "10m" }
  );
  const params = new URLSearchParams({
    client_id: ENV.MICROSOFT_CLIENT_ID,
    response_type: "code",
    redirect_uri: ENV.MICROSOFT_REDIRECT_URI,
    scope: "openid email profile User.Read",
    state,
    response_mode: "query",
  });
  return `${AUTH_BASE}/authorize?${params}`;
};

export const validateMicrosoftState = (state) => {
  try {
    jwt.verify(state, ENV.JWT_SECRET);
    return true;
  } catch {
    return false;
  }
};

export const getMicrosoftAccessToken = async (code) => {
  const body = new URLSearchParams({
    client_id: ENV.MICROSOFT_CLIENT_ID,
    client_secret: ENV.MICROSOFT_CLIENT_SECRET,
    code,
    redirect_uri: ENV.MICROSOFT_REDIRECT_URI,
    grant_type: "authorization_code",
  });
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "Microsoft token exchange failed");
  return data.access_token;
};

export const getMicrosoftUserInfo = async (accessToken) => {
  const res = await fetch(GRAPH_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error("ไม่สามารถดึงข้อมูลผู้ใช้จาก Microsoft ได้");
  return {
    microsoftId: data.id,
    email: data.mail || data.userPrincipalName,
    name: data.displayName,
  };
};

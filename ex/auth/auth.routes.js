import express from "express";
import * as authController from "./auth.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { strictRateLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

// Public routes (ใช้ strict rate limiter เพื่อป้องกัน brute force)
router.post("/register",  authController.register);
router.post("/login",  authController.login);

// Microsoft SSO routes
router.get("/microsoft", authController.microsoftLogin);
router.get("/microsoft/callback", authController.microsoftCallback);

router.use(authenticateToken)
// Protected routes
router.get("/me",  authController.getProfile);

export default router;
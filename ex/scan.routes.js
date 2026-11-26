import express from "express";
import { scanController } from "./scan.controller.js";
import { authenticateToken, requirePermission } from "../middlewares/auth.middleware.js";
import { requireCNGroupAccess } from "../utils/customer-auth.js";
import { PERMISSIONS } from "../../constants/permissions.js";

const router = express.Router();

// Summary
router.post("/summary", authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), scanController.getSummary);

// Companies (สำหรับ Company Filter)
router.get("/companies", authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), requireCNGroupAccess, scanController.getCompanies);

// Departments (สำหรับ Department Filter)
router.get("/departments", authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), requireCNGroupAccess, scanController.getDepartments);

// Dashboard
router.post("/dashboard", authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), scanController.getDashboard);

// รายการสแกน
router.get("/list", authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), scanController.getList);

// สแกนจุดตรวจ
router.post("/checkpoint", authenticateToken, requirePermission(PERMISSIONS.SCAN_CREATE), scanController.scanCheckpoint);

// ยกเลิกการสแกน
router.delete("/:id", authenticateToken, requirePermission(PERMISSIONS.SCAN_DELETE), scanController.cancelScan);

// ดึงรายชื่อ Users ที่เคยลงทะเบียนใน CNGroup (สำหรับ User Filter)
router.get(
  "/registering-users/:cnGroupId",
  authenticateToken,
  requirePermission(PERMISSIONS.SCAN_READ),
  scanController.getRegisteringUsers
);

// ดึงรายชื่อ patients สำหรับ Scan Modal
router.get(
  "/patients/:cnGroupId/:status",
  authenticateToken,
  requirePermission(PERMISSIONS.SCAN_READ),
  scanController.getPatientsByScanStatus
);

// ดึงรายการสแกนตาม Membership ID
router.get(
  "/membership/:membershipId",
  authenticateToken,
  requirePermission(PERMISSIONS.SCAN_READ),
  scanController.getScanItemsByMembership
);

// ดึงรายชื่อ patients ตาม Station
router.get(
  "/station/:cnGroupId/:stationId/patients",
  authenticateToken,
  requirePermission(PERMISSIONS.SCAN_READ),
  scanController.getPatientsByStation
);

// ดึงรายชื่อ patients ตาม Station สำหรับ Customer
router.get(
  "/customer/:cnGroupId/:stationId/patients",
  authenticateToken,
  requireCNGroupAccess,
  scanController.getPatientsByStationForCustomer
);

// ดึงสถิติการยิงตัวอย่างของ user วันนี้
router.get(
  "/summary/me",
  authenticateToken,
  requirePermission(PERMISSIONS.SCAN_READ),
  scanController.getUserScanSummaryToday
);

// Bulk update scan log
router.post(
  "/bulk-update-scanlog",
  authenticateToken,
  requirePermission(PERMISSIONS.SCAN_UPDATE),
  scanController.bulkUpdateScanlog
);

// Recheck
router.post("/recheck", authenticateToken, requirePermission(PERMISSIONS.SCAN_CREATE), scanController.recheckCheckpoint);
router.delete("/recheck/:id", authenticateToken, requirePermission(PERMISSIONS.SCAN_UPDATE), scanController.cancelRecheck);
router.post("/recheck/cancel-unbacked-receipt/bulk", authenticateToken, requirePermission(PERMISSIONS.SCAN_UPDATE), scanController.bulkCancelUnbackedReceipts);
router.post("/recheck/cancel-unbacked-receipt", authenticateToken, requirePermission(PERMISSIONS.SCAN_UPDATE), scanController.cancelUnbackedReceipt);
router.get("/recheck/lab-stations", authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), scanController.getLabStations);
router.get("/recheck/summary", authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), scanController.getRecheckSummary);
router.get("/recheck/station-patients", authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), scanController.getRecheckStationPatients);
router.get("/recheck/exceptions", authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), scanController.getRecheckExceptions);
// ต้องมาก่อน /:id ไม่งั้น "bulk" จะถูกจับเป็น id
router.patch("/recheck/exceptions/bulk", authenticateToken, requirePermission(PERMISSIONS.SCAN_UPDATE), scanController.bulkResolveRecheckExceptions);
router.patch("/recheck/exceptions/:id", authenticateToken, requirePermission(PERMISSIONS.SCAN_UPDATE), scanController.resolveRecheckException);

// งานที่ Lab ส่งมาขอให้ทะเบียนดำเนินการ (ตัวอย่างมาถึงแล้วแต่หน้างานลืมยิง)
router.post("/recheck/request-registration-scan", authenticateToken, requirePermission(PERMISSIONS.SCAN_UPDATE), scanController.requestRegistrationScan);
router.get("/registration-tasks/summary", authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), scanController.getRegistrationTaskSummary);
router.get("/registration-tasks", authenticateToken, requirePermission(PERMISSIONS.SCAN_READ), scanController.getRegistrationTasks);
router.post("/registration-tasks/bulk-confirm", authenticateToken, requirePermission(PERMISSIONS.SCAN_CREATE), scanController.bulkConfirmRegistrationTasks);
router.post("/registration-tasks/bulk-reject", authenticateToken, requirePermission(PERMISSIONS.SCAN_UPDATE), scanController.bulkRejectRegistrationTasks);
router.post("/registration-tasks/:id/confirm", authenticateToken, requirePermission(PERMISSIONS.SCAN_CREATE), scanController.confirmRegistrationTask);
router.post("/registration-tasks/:id/reject", authenticateToken, requirePermission(PERMISSIONS.SCAN_UPDATE), scanController.rejectRegistrationTask);

export default router;

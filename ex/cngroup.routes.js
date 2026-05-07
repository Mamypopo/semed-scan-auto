import express from "express";
import { PERMISSIONS } from "../../constants/permissions.js";
import * as cnGroupController from "./cngroup.controller.js";
import { authenticateToken, requirePermission } from "../middlewares/auth.middleware.js";
import expectedItemRoutes from "../cngroup-expected-item/cngroup-expected-item.routes.js";

const router = express.Router();

// Get CNGroups for Customer Dashboard Select (no auth required - like old system)
// ต้องอยู่ก่อน authenticateToken middleware
router.get("/customer-dashboard", cnGroupController.getCNGroupsForCustomerDashboard);

// Protected routes - require authentication
router.use(authenticateToken);

// Get all CNGroups
router.get("/", cnGroupController.getAllCNGroups);

// Get all CNGroups for dropdown
router.get("/dropdown", cnGroupController.getAllCNGroupsForDropdown);

// Get CNGroup by ID
router.get("/:id", cnGroupController.getCNGroupById);

// Get CNGroup by ID for edit (minimal data only)
router.get("/:id/edit", cnGroupController.getCNGroupByIdForEdit);

// Get company names from CNGroupMembership for a specific CNGroup
router.get("/:id/company-names", cnGroupController.getCompanyNamesByCNGroup);

// Get company addresses from CNGroupMembership for a specific CNGroup
router.get("/:id/company-addresses", cnGroupController.getCompanyAddressesByCNGroup);

// Get registration dates from Registration for a specific CNGroup
router.get("/:id/registration-dates", cnGroupController.getRegistrationDatesByCNGroup);

// Get stations summary for CNGroup
router.get("/:id/stations", cnGroupController.getStationsInCNGroup);

// Get stations for active counts setting
router.get("/:id/stations-for-active-counts", cnGroupController.getStationsForActiveCounts);

// Input Group (MedicalItem) summary & delete for CNGroup
router.get("/:id/input-group", cnGroupController.getMedicalItemsSummaryForCNGroup);
router.delete("/:id/input-group/all", requirePermission(PERMISSIONS.CNGROUP_UPDATE), cnGroupController.deleteAllInputGroupForCNGroupController);
router.delete("/:id/input-group/:medicalItemId", requirePermission(PERMISSIONS.CNGROUP_UPDATE), cnGroupController.deleteMedicalItemForCNGroup);

// Input Exam (ScanItem) summary & delete for CNGroup
router.get("/:id/input-exam", cnGroupController.getInputExamSummaryController);
router.delete("/:id/input-exam/all", requirePermission(PERMISSIONS.CNGROUP_UPDATE), cnGroupController.deleteAllInputExamForCNGroupController);
router.delete("/:id/input-exam/:stationId", requirePermission(PERMISSIONS.CNGROUP_UPDATE), cnGroupController.deleteInputExamForStationController);

// Special Checkup (PatientExaminationItem type SPECIAL) delete for CNGroup
router.delete("/:id/special-checkup", requirePermission(PERMISSIONS.CNGROUP_UPDATE), cnGroupController.deleteSpecialCheckupForCNGroupController);

// Expected Items (nested route)
router.use("/:cnGroupId/expected-items", expectedItemRoutes);

// Create CNGroup
router.post("/", requirePermission(PERMISSIONS.CNGROUP_CREATE), cnGroupController.createCNGroup);

// Update CNGroup
router.put("/:id", requirePermission(PERMISSIONS.CNGROUP_UPDATE), cnGroupController.updateCNGroup);

// Update CNGroup active status
router.patch("/:id/active", requirePermission(PERMISSIONS.CNGROUP_UPDATE), cnGroupController.updateCNGroupActive);

// Delete CNGroup
router.delete("/:id", requirePermission(PERMISSIONS.CNGROUP_DELETE), cnGroupController.deleteCNGroup);

export default router;


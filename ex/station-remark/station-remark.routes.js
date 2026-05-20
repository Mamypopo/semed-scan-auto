import express from "express";
import * as stationRemarkController from "./station-remark.controller.js";
import { authenticateToken, requirePermission } from "../middlewares/auth.middleware.js";
import { PERMISSIONS } from "../../constants/permissions.js";

const router = express.Router();

// สร้างหรืออัปเดต StationRemark
router.post(
  "/",
  authenticateToken,
  requirePermission(PERMISSIONS.STATION_REMARK_CREATE),
  stationRemarkController.upsertStationRemark
);

router.delete('/cng/:patientCNGroupId/station/:stationId', authenticateToken, requirePermission(PERMISSIONS.STATION_REMARK_DELETE), stationRemarkController.deleteRemarkByCNG)
router.delete('/membership/:patientMembershipId/station/:stationId', authenticateToken, requirePermission(PERMISSIONS.STATION_REMARK_DELETE), stationRemarkController.deleteRemarkByMembership)

export default router;

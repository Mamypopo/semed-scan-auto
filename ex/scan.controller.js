import {
  scanCheckpoint as scanCheckpointService,
  cancelScan as cancelScanService,
  getScanDashboard as getScanDashboardService,
  getScanSummary as getScanSummaryService,
  getScanList as getScanListService,
  getCompaniesByCNGroup as getCompaniesByCNGroupService,
  getDepartmentsByCNGroup as getDepartmentsByCNGroupService,
  getPatientsByScanStatus as getPatientsByScanStatusService,
  getScanItemsByMembership as getScanItemsByMembershipService,
  getPatientsByStation as getPatientsByStationService,
  getPatientsByStationForCustomer as getPatientsByStationForCustomerService,
  getUserScanSummaryToday as getUserScanSummaryTodayService,
  bulkUpdateScanlog as bulkUpdateScanlogService,
  getRegisteringUsers as getRegisteringUsersService,
} from "./scan.service.js";
import { createScanItemLog } from "../Loggers/scanItemLogger.js";
import { createSystemLog } from '../utils/logger.js'
import { emitScanAndCustomerDashboardUpdate } from "../socket/socket.service.js";

export const scanController = {
  /**
   * POST /api/v1/scan/checkpoint
   * สแกนจุดตรวจ (ใช้ CN.STATION_ID หรือ CN + stationId)
   */
  async scanCheckpoint(req, res, next) {
    try {
      const userId = req.user?.id;
      const { cn, stationId, cnGroupId, deleteRemark = false } = req.body;

      if (!cn) {
        return res.status(400).json({
          success: false,
          message: "กรุณาระบุ CN",
        });
      }

      const result = await scanCheckpointService({
        cn,
        stationId,
        userId,
        cnGroupId,
        deleteRemark,
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);

      // สร้าง ScanItem Log
      if (result.scanItem && result.isNewScan) {
        createScanItemLog({
          scanItemId: result.scanItem.id,
          action: "SCAN",
          details: {
            cn: result.membership.cn,
            patientName: `${result.patient.prefix || ""} ${
              result.patient.first_name
            } ${result.patient.last_name}`,
            stationName: result.station.name,
            scannedAt: result.scanItem.scannedAt,
            wasReinstated: result.wasReinstated || false,
          },
          userId: userId ? parseInt(userId) : null,
          hn: result.patient.hn,
        }).catch((err) => {
          console.error("Error creating scan item log:", err);
        });
      }

      // Emit WebSocket event สำหรับ real-time dashboard update
      const emitCNGroupId =
        cnGroupId ||
        result.membership?.cnGroup?.id ||
        result.membership?.cnGroupId;
      if (emitCNGroupId) {
        const io = req.app.get("io");
        if (io) {
          // Best Practice: Promise.all query พร้อมกัน
          emitScanAndCustomerDashboardUpdate(io, emitCNGroupId, result.station?.id || null);
        }
      }
    } catch (err) {
      console.error("Error in scanCheckpoint:", err);
      next(err);
    }
  },

  /**
   * DELETE /api/v1/scan/:id
   * ยกเลิกการสแกน
   */
  async cancelScan(req, res, next) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "กรุณาระบุ ID ของการสแกน",
        });
      }

      const result = await cancelScanService(id, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);

      // สร้าง ScanItem Log
      if (result.scanItem) {
        createScanItemLog({
          scanItemId: result.scanItem.id,
          action: "CANCEL",
          details: {
            cancelledAt: new Date(),
            reason: "ยกเลิกการสแกน",
            patientName: `${result.scanItem.patient.first_name} ${result.scanItem.patient.last_name}`,
            stationName: result.scanItem.station.name,
          },
          userId: userId ? parseInt(userId) : null,
          hn: result.scanItem.patient.hn,
        }).catch((err) => {
          console.error("Error creating scan item log:", err);
        });
      }

      // Emit WebSocket event สำหรับ real-time dashboard update
      const emitCNGroupId =
        result.scanItem?.registration?.patientCNGroup?.cnGroupId;
      if (emitCNGroupId) {
        const io = req.app.get("io");
        if (io) {
          // Best Practice: Promise.all query พร้อมกัน
          emitScanAndCustomerDashboardUpdate(io, emitCNGroupId, result.scanItem.stationId);
        }
      }
    } catch (err) {
      console.error("Error in cancelScan:", err);
      next(err);
    }
  },

  /**
   * POST /api/v1/scan/summary
   * ดึงสถิติสรุปสำหรับ Header Summary Bar (เบากว่า dashboard)
   */
  async getSummary(req, res, next) {
    try {
      const { cnGroupId, companies, createdByUserIds } = req.body;

      if (!cnGroupId) {
        return res.status(400).json({
          success: false,
          message: "กรุณาระบุ CNGroup ID",
        });
      }

      // Parse companies array
      let companiesArray = [];
      if (companies) {
        if (Array.isArray(companies)) {
          companiesArray = companies.filter((c) => c && c.trim() !== "");
        } else if (typeof companies === "string") {
          companiesArray = companies.split(",").filter((c) => c.trim() !== "");
        }
      }

      // Parse createdByUserIds array
      let userIdsArray = [];
      if (createdByUserIds) {
        if (Array.isArray(createdByUserIds)) {
          userIdsArray = createdByUserIds.map(Number).filter(Boolean);
        } else if (typeof createdByUserIds === "string") {
          userIdsArray = createdByUserIds.split(",").map(Number).filter(Boolean);
        }
      }

      const summaryData = await getScanSummaryService(
        cnGroupId,
        companiesArray,
        userIdsArray
      );

      res.status(200).json({
        success: true,
        data: summaryData,
      });
    } catch (err) {
      console.error("Error in getSummary:", err);
      next(err);
    }
  },

  /**
   * GET /api/v1/scan/dashboard
   * ดึงสถิติการสแกนสำหรับ CNGroup
   */
  async getDashboard(req, res, next) {
    try {
      const { cnGroupId, stationId, companies, createdByUserIds } = req.body;

      if (!cnGroupId) {
        return res.status(400).json({
          success: false,
          message: "กรุณาระบุ CNGroup ID",
        });
      }

      let companiesArray = [];
      if (companies) {
        if (Array.isArray(companies)) {
          companiesArray = companies.filter((c) => c && c.trim() !== "");
        } else if (typeof companies === "string") {
          companiesArray = companies.split(",").filter((c) => c.trim() !== "");
        }
      }

      // Parse createdByUserIds array
      let userIdsArray = [];
      if (createdByUserIds) {
        if (Array.isArray(createdByUserIds)) {
          userIdsArray = createdByUserIds.map(Number).filter(Boolean);
        } else if (typeof createdByUserIds === "string") {
          userIdsArray = createdByUserIds.split(",").map(Number).filter(Boolean);
        }
      }

      const dashboardData = await getScanDashboardService(
        cnGroupId,
        stationId ? parseInt(stationId) : null,
        companiesArray,
        userIdsArray
      );

      res.status(200).json({
        success: true,
        data: dashboardData,
      });
    } catch (err) {
      console.error("Error in getDashboard:", err);
      next(err);
    }
  },

  /**
   * GET /api/v1/scan/companies
   * ดึงรายชื่อบริษัททั้งหมดใน CNGroup (สำหรับ Company Filter)
   */
  async getCompanies(req, res, next) {
    try {
      const { cnGroupId } = req.query;

      if (!cnGroupId) {
        return res.status(400).json({
          success: false,
          message: "กรุณาระบุ CNGroup ID",
        });
      }

      const companies = await getCompaniesByCNGroupService(cnGroupId);

      res.status(200).json({
        success: true,
        data: companies,
      });
    } catch (err) {
      console.error("Error in getCompanies:", err);
      next(err);
    }
  },

  /**
   * GET /api/v1/scan/departments
   * ดึงรายชื่อแผนกทั้งหมดใน CNGroup (สำหรับ Department Filter)
   */
  async getDepartments(req, res, next) {
    try {
      const { cnGroupId, companies } = req.query;

      if (!cnGroupId) {
        return res.status(400).json({
          success: false,
          message: "กรุณาระบุ CNGroup ID",
        });
      }

      // Parse companies from query string (can be array or single value)
      let companiesArray = [];
      if (companies) {
        if (Array.isArray(companies)) {
          companiesArray = companies;
        } else if (typeof companies === 'string') {
          companiesArray = [companies];
        }
      }

      const departments = await getDepartmentsByCNGroupService(cnGroupId, companiesArray);

      res.status(200).json({
        success: true,
        data: departments,
      });
    } catch (err) {
      console.error("Error in getDepartments:", err);
      next(err);
    }
  },

  /**
   * GET /api/v1/scan/list
   * ดึงรายการสแกน
   */
  async getList(req, res, next) {
    try {
      const {
        cnGroupId,
        stationId,
        page = 1,
        limit = 20,
        search = "",
        dateFrom = null,
        dateTo = null,
        isCancelled = false,
      } = req.query;

      const result = await getScanListService({
        cnGroupId,
        stationId: stationId ? parseInt(stationId) : null,
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        dateFrom,
        dateTo,
        isCancelled: isCancelled === "true" || isCancelled === true,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      console.error("Error in getList:", err);
      next(err);
    }
  },

  /**
   * ดึงรายชื่อ patients สำหรับ Scan Modal
   */
  async getPatientsByScanStatus(req, res, next) {
    try {
      const { cnGroupId, status } = req.params;
      const {
        search = "",
        page = 1,
        limit = 10,
        sortBy = "cn",
        sortOrder = "asc",
        remarkFilter = "all",
        companies = [],
        createdByUserIds,
      } = req.query;

      if (!cnGroupId) {
        return res.status(400).json({
          success: false,
          message: "กรุณาระบุ CNGroup ID",
        });
      }

      if (
        !status ||
        !["all", "registered", "unregistered", "special_checkup"].includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "กรุณาระบุ status ที่ถูกต้อง (all, registered, unregistered, special_checkup)",
        });
      }

      // Parse companies (รองรับทั้ง string และ array)
      let companiesArray = [];
      if (companies) {
        if (typeof companies === "string") {
          try {
            companiesArray = JSON.parse(companies);
          } catch (e) {
            companiesArray = companies.split(",").filter((c) => c.trim());
          }
        } else if (Array.isArray(companies)) {
          companiesArray = companies;
        }
      }

      // Parse createdByUserIds from query string
      let userIdsArray = [];
      if (createdByUserIds) {
        if (typeof createdByUserIds === "string") {
          try {
            userIdsArray = JSON.parse(createdByUserIds);
          } catch (e) {
            userIdsArray = createdByUserIds.split(",").map(Number).filter(Boolean);
          }
        } else if (Array.isArray(createdByUserIds)) {
          userIdsArray = createdByUserIds.map(Number).filter(Boolean);
        }
      }

      const result = await getPatientsByScanStatusService(cnGroupId, status, {
        search,
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder,
        remarkFilter,
        companies: companiesArray,
        createdByUserIds: userIdsArray,
      });

      res.json(result);
    } catch (err) {
      console.error("❌ Get Patients By Scan Status Controller Error:", err);
      next(err);
    }
  },

  /**
   * GET /api/v1/scan/membership/:membershipId
   * ดึงรายการสแกนตาม Membership ID
   */
  async getScanItemsByMembership(req, res, next) {
    try {
      const { membershipId } = req.params;
      const { page = 1, limit = 20, isCancelled } = req.query;

      // แปลง query string เป็น boolean หรือ undefined
      let isCancelledValue = undefined;
      if (
        isCancelled !== undefined &&
        isCancelled !== null &&
        isCancelled !== ""
      ) {
        isCancelledValue = isCancelled === "true" || isCancelled === true;
      }

      const result = await getScanItemsByMembershipService(membershipId, {
        page: parseInt(page),
        limit: parseInt(limit),
        isCancelled: isCancelledValue,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      console.error("❌ Get Scan Items By Membership Controller Error:", err);
      next(err);
    }
  },

  /**
   * GET /api/v1/scan/station/:cnGroupId/:stationId/patients
   * ดึงรายชื่อ patients ตาม Station
   */
  async getPatientsByStation(req, res, next) {
    try {
      const { cnGroupId, stationId } = req.params;
      const {
        search = "",
        page = 1,
        limit = 10,
        sortBy = "cn",
        sortOrder = "asc",
        scanStatus = "all",
        registrationStatus = "all",
        stationRemarkFilter = "all",
        companies = [],
        createdByUserIds,
        examType = null,
      } = req.query;

      if (!cnGroupId) {
        return res.status(400).json({
          success: false,
          message: "กรุณาระบุ CNGroup ID",
        });
      }

      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: "กรุณาระบุ Station ID",
        });
      }

      // Parse companies (รองรับทั้ง string และ array)
      let companiesArray = [];
      if (companies) {
        if (typeof companies === "string") {
          try {
            companiesArray = JSON.parse(companies);
          } catch (e) {
            companiesArray = companies.split(",").filter((c) => c.trim());
          }
        } else if (Array.isArray(companies)) {
          companiesArray = companies;
        }
      }

      // Parse createdByUserIds from query string
      let userIdsArray = [];
      if (createdByUserIds) {
        if (typeof createdByUserIds === "string") {
          try {
            userIdsArray = JSON.parse(createdByUserIds);
          } catch (e) {
            userIdsArray = createdByUserIds.split(",").map(Number).filter(Boolean);
          }
        } else if (Array.isArray(createdByUserIds)) {
          userIdsArray = createdByUserIds.map(Number).filter(Boolean);
        }
      }

      const result = await getPatientsByStationService(
        cnGroupId,
        parseInt(stationId),
        {
          search,
          page: parseInt(page),
          limit: parseInt(limit),
          sortBy,
          sortOrder,
          scanStatus,
          registrationStatus,
          stationRemarkFilter,
          companies: companiesArray,
          createdByUserIds: userIdsArray,
          examType: examType || null,
        }
      );

      res.json(result);
    } catch (err) {
      console.error("❌ Get Patients By Station Controller Error:", err);
      next(err);
    }
  },

  /**
   * GET /api/v1/scan/customer/:cnGroupId/:stationId/patients
   * ดึงรายชื่อ patients ตาม Station สำหรับ Customer (Public view)
   * - Summary แสดงข้อมูลทั้งหมดของ station เสมอ
   */
  async getPatientsByStationForCustomer(req, res, next) {
    try {
      const { cnGroupId, stationId } = req.params;
      const {
        search = "",
        page = 1,
        limit = 10,
        sortBy = "cn",
        sortOrder = "asc",
        scanStatus = "all",
        registrationStatus = "all",
        stationRemarkFilter = "all",
        companies = [],
      } = req.query;

      if (!cnGroupId) {
        return res.status(400).json({
          success: false,
          message: "กรุณาระบุ CNGroup ID",
        });
      }

      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: "กรุณาระบุ Station ID",
        });
      }

      // Parse companies
      let companiesArray = [];
      if (companies) {
        if (typeof companies === "string") {
          try {
            companiesArray = JSON.parse(companies);
          } catch (e) {
            companiesArray = companies.split(",").filter((c) => c.trim());
          }
        } else if (Array.isArray(companies)) {
          companiesArray = companies;
        }
      }

      const result = await getPatientsByStationForCustomerService(
        cnGroupId,
        parseInt(stationId),
        {
          search,
          page: parseInt(page),
          limit: parseInt(limit),
          sortBy,
          sortOrder,
          scanStatus,
          registrationStatus,
          stationRemarkFilter,
          companies: companiesArray,
        }
      );

      res.json(result);
    } catch (err) {
      console.error("❌ Get Patients By Station For Customer Controller Error:", err);
      next(err);
    }
  },

  /**
   * GET /api/v1/scan/summary/me
   * ดึงสถิติการยิงตัวอย่างของ user วันนี้
   */
  async getUserScanSummaryToday(req, res, next) {
    try {
      const userId = req.user?.id
      const cnGroupId = req.query.cnGroupId

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        })
      }

      if (!cnGroupId) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุ cnGroupId'
        })
      }

      const summary = await getUserScanSummaryTodayService(userId, cnGroupId)
      res.status(200).json(summary)
    } catch (err) {
      console.error('Error in getUserScanSummaryToday:', err)
      res.status(400).json({
        success: false,
        message: err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล'
      })
    }
  },

  /**
   * GET /api/v1/scan/registering-users/:cnGroupId
   * ดึงรายชื่อ Users ที่เคยลงทะเบียนใน CNGroup นั้น
   */
  async getRegisteringUsers(req, res, next) {
    try {
      const { cnGroupId } = req.params;

      if (!cnGroupId) {
        return res.status(400).json({
          success: false,
          message: "กรุณาระบุ CNGroup ID",
        });
      }

      const users = await getRegisteringUsersService(cnGroupId);

      res.status(200).json({
        success: true,
        data: users,
      });
    } catch (err) {
      console.error("Error in getRegisteringUsers:", err);
      next(err);
    }
  },

  /**
   * POST /api/v1/scan/bulk-update-scanlog
   * Bulk update scan log for a patient
   */
  async bulkUpdateScanlog(req, res, next) {
    try {
      const { patientHN, cnGroupId, stationIds } = req.body
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' })
      }

      if (!patientHN || !cnGroupId || !Array.isArray(stationIds)) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุข้อมูลให้ครบถ้วน'
        })
      }

      const result = await bulkUpdateScanlogService(
        patientHN,
        cnGroupId,
        stationIds,
        userId
      )

      if (result.success) {
        createSystemLog(req, 'BULK_UPDATE_SCANLOG', { patientHN, cnGroupId, stationIds, message: result.message }).catch(() => {})
        res.status(200).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('Error in bulkUpdateScanlog controller:', error)
      next(error)
    }
  },
};

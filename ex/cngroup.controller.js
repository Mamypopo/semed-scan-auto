import * as cnGroupService from "./cngroup.service.js";
import { createSystemLog } from "../utils/logger.js";

/**
 * Get all CNGroups
 * GET /api/v1/cngroups
 */
export const getAllCNGroups = async (req, res) => {
  try {
    const { 
      isActive, 
      search, 
      companyId,
      source,
      page, 
      pageSize, 
      sort, 
      order 
    } = req.query;
    
    const filters = {
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
      ...(search && { search }),
      ...(companyId && { companyId }),
      ...(source && { source }),
      ...(page && { page: Number(page) }),
      ...(pageSize && { pageSize: Number(pageSize) }),
      ...(sort && { sort }),
      ...(order && { order })
    };

    const { cnGroups, total } = await cnGroupService.getAllCNGroups(filters);

    res.status(200).json({
      success: true,
      data: cnGroups,
      meta: {
        total,
        page: Number(page) || 1,
        pageSize: Number(pageSize) || 10,
        totalPages: Math.max(1, Math.ceil(total / (Number(pageSize) || 10)))
      }
    });

  } catch (error) {
    console.error("Get CNGroups error:", error);
    
    res.status(500).json({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการดึงข้อมูล CNGroup"
    });
  }
};

/**
 * Get all CNGroups for dropdown
 * GET /api/v1/cngroups/dropdown
 */
export const getAllCNGroupsForDropdown = async (req, res) => {
  try {
    const { search, limit, companyId, isActive } = req.query;
    
    const filters = {
      ...(search && { search }),
      ...(limit && { limit: Number(limit) }),
      ...(companyId && { companyId }),
      ...(isActive !== undefined && { isActive: isActive === 'true' })
    };

    const cnGroups = await cnGroupService.getAllCNGroupsForDropdown(filters);

    res.status(200).json({
      success: true,
      message: 'ดึงข้อมูล CNGroup สำเร็จ',
      data: cnGroups
    });

  } catch (error) {
    console.error('Get CNGroups for dropdown error:', error);
    
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล CNGroup'
    });
  }
};

/**
 * Get CNGroups for Customer Dashboard Select
 * GET /api/v1/cngroups/customer-dashboard
 */
export const getCNGroupsForCustomerDashboard = async (req, res) => {
  try {
    const { 
      search,
      page, 
      pageSize,
      isActive
    } = req.query;
    
    const filters = {
      ...(search && { search }),
      ...(page && { page: Number(page) }),
      ...(pageSize && { pageSize: Number(pageSize) }),
      ...(isActive !== undefined && { isActive: isActive === 'true' })
    };

    const result = await cnGroupService.getCNGroupsForCustomerDashboard(filters);

    res.status(200).json({
      success: true,
      data: {
        cnGroups: result.cnGroups,
        total: result.total
      },
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage
      }
    });

  } catch (error) {
    console.error('Get CNGroups for Customer Dashboard error:', error);
    
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล CNGroup'
    });
  }
};

/**
 * Get CNGroup by ID
 * GET /api/v1/cngroups/:id
 */
export const getCNGroupById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID CNGroup ไม่ถูกต้อง"
      });
    }

    const cnGroup = await cnGroupService.getCNGroupById(id);

    res.status(200).json({
      success: true,
      data: {
        cnGroup
      }
    });

  } catch (error) {
    console.error("Get CNGroup error:", error);
    
    const statusCode = error.message === "ไม่พบ CNGroup ที่ระบุ" ? 404 : 500;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการดึงข้อมูล CNGroup"
    });
  }
};

/**
 * Get CNGroup by ID for edit (minimal data only)
 * GET /api/v1/cngroups/:id/edit
 */
export const getCNGroupByIdForEdit = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID CNGroup ไม่ถูกต้อง"
      });
    }

    const cnGroup = await cnGroupService.getCNGroupByIdForEdit(id);

    res.status(200).json({
      success: true,
      data: cnGroup
    });

  } catch (error) {
    console.error("Get CNGroup for edit error:", error);

    const statusCode = error.message === "ไม่พบ CNGroup ที่ระบุ" ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการดึงข้อมูล CNGroup"
    });
  }
};

/**
 * Get company names from CNGroupMembership for a specific CNGroup
 * GET /api/v1/cngroups/:id/company-names
 */
export const getCompanyNamesByCNGroup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'CNGroup ID is required'
      });
    }

    const companyNames = await cnGroupService.getCompanyNamesByCNGroup(id);

    res.status(200).json({
      success: true,
      message: 'ดึงข้อมูลชื่อบริษัทสำเร็จ',
      data: companyNames
    });

  } catch (error) {
    console.error('Get company names by CNGroup error:', error);
    
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลชื่อบริษัท'
    });
  }
};

/**
 * Get company addresses from CNGroupMembership for a specific CNGroup
 * GET /api/v1/cngroups/:id/company-addresses
 */
export const getCompanyAddressesByCNGroup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'CNGroup ID is required'
      });
    }

    const companyAddresses = await cnGroupService.getCompanyAddressesByCNGroup(id);

    res.status(200).json({
      success: true,
      message: 'ดึงข้อมูลที่อยู่บริษัทสำเร็จ',
      data: companyAddresses
    });

  } catch (error) {
    console.error('Get company addresses by CNGroup error:', error);
    
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลที่อยู่บริษัท'
    });
  }
};

/**
 * Get registration dates from Registration for a specific CNGroup
 * GET /api/v1/cngroups/:id/registration-dates
 */
export const getRegistrationDatesByCNGroup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'CNGroup ID is required'
      });
    }

    const registrationDates = await cnGroupService.getRegistrationDatesByCNGroup(id);

    res.status(200).json({
      success: true,
      message: 'ดึงข้อมูลวันที่ลงทะเบียนสำเร็จ',
      data: registrationDates
    });

  } catch (error) {
    console.error('Get registration dates by CNGroup error:', error);
    
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลวันที่ลงทะเบียน'
    });
  }
};

/**
 * Create new CNGroup
 * POST /api/v1/cngroups
 */
export const createCNGroup = async (req, res) => {
  try {
    const { 
      name, 
      code, 
      companyId, 
      note, 
      includeQRCode, 
      peNote, 
      progressLink,
      comparisonDiffThresholdPercent,
      // Workflow fields
      useWorkflow,
      targetEndDate,
      taskTemplateId,
    } = req.body;

    // Basic validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกชื่อ CNGroup"
      });
    }

    const newCNGroup = await cnGroupService.createCNGroup({
      name,
      code,
      companyId,
      note,
      includeQRCode,
      peNote,
      progressLink,
      comparisonDiffThresholdPercent,
      createdBy: req.user?.id,
      // Workflow fields
      useWorkflow,
      targetEndDate,
      taskTemplateId
    });

    // Log system action
    await createSystemLog(req, "CREATE_CNGROUP", {
      cnGroupId: newCNGroup.id,
      name: newCNGroup.name,
      companyId: newCNGroup.companyId
    });

    res.status(201).json({
      success: true,
      message: "สร้าง CNGroup สำเร็จ",
      data: {
        cnGroup: newCNGroup
      }
    });

  } catch (error) {
    console.error("Create CNGroup error:", error);
    
    let statusCode = 500;
    if (error.message === "ชื่อ CNGroup นี้มีอยู่แล้ว") {
      statusCode = 409;
    }
    
    res.status(statusCode).json({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการสร้าง CNGroup"
    });
  }
};

/**
 * Update CNGroup
 * PUT /api/v1/cngroups/:id
 */
export const updateCNGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      code, 
      companyId, 
      note, 
      includeQRCode, 
      peNote, 
      progressLink, 
      isActive,
      stationActiveCounts,
      comparisonDiffThresholdPercent,
      // Workflow fields
      projectStartDate,
      useWorkflow,
      targetEndDate,
      taskTemplateId
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID CNGroup ไม่ถูกต้อง"
      });
    }

    const updatedCNGroup = await cnGroupService.updateCNGroup(id, {
      name,
      code,
      companyId,
      note,
      includeQRCode,
      peNote,
      progressLink,
      isActive,
      stationActiveCounts,
      comparisonDiffThresholdPercent,
      updatedBy: req.user?.id,

      // Workflow fields
      projectStartDate,
      useWorkflow,
      targetEndDate,
      taskTemplateId
    });

    // Log system action
    await createSystemLog(req, "UPDATE_CNGROUP", {
      cnGroupId: updatedCNGroup.id,
      name: updatedCNGroup.name,
      companyId: updatedCNGroup.companyId
    });

    res.status(200).json({
      success: true,
      message: "อัปเดต CNGroup สำเร็จ",
      data: {
        cnGroup: updatedCNGroup
      }
    });

  } catch (error) {
    console.error("Update CNGroup error:", error);
    
    let statusCode = 500;
    if (error.message === "ไม่พบ CNGroup ที่ระบุ") statusCode = 404;
    if (error.message === "ชื่อ CNGroup นี้มีอยู่แล้ว") {
      statusCode = 409;
    }
    
    res.status(statusCode).json({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการอัปเดต CNGroup"
    });
  }
};

/**
 * Update CNGroup active status
 * PATCH /api/v1/cngroups/:id/active
 */
export const updateCNGroupActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID CNGroup ไม่ถูกต้อง"
      });
    }
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: "isActive ต้องเป็นค่า boolean"
      });
    }

    const updatedCNGroup = await cnGroupService.updateCNGroupActive(id, isActive, req.user?.id);

    // Log system action
    await createSystemLog(req, isActive ? "ACTIVATE_CNGROUP" : "DEACTIVATE_CNGROUP", {
      cnGroupId: updatedCNGroup.id,
      name: updatedCNGroup.name,
      isActive
    });

    res.status(200).json({
      success: true,
      message: "อัปเดตสถานะ CNGroup สำเร็จ",
      data: {
        cnGroup: updatedCNGroup
      }
    });

  } catch (error) {
    console.error("Update CNGroup active error:", error);
    
    let statusCode = 500;
    if (error.message === "ไม่พบ CNGroup ที่ระบุ") statusCode = 404;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการอัปเดตสถานะ CNGroup"
    });
  }
};


/**
 * Get stations summary for CNGroup
 * GET /api/v1/cngroups/:id/stations
 */
export const getStationsInCNGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { companies } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID CNGroup ไม่ถูกต้อง"
      });
    }

    // Parse companies from query string (can be comma-separated or array)
    let companyArray = [];
    if (companies) {
      if (typeof companies === 'string') {
        companyArray = companies.split(',').map(c => c.trim()).filter(c => c);
      } else if (Array.isArray(companies)) {
        companyArray = companies;
      }
    }

    const result = await cnGroupService.getStationsInCNGroup(id, companyArray);

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("Get stations in CNGroup error:", error);
    
    const statusCode = error.message === "ไม่พบข้อมูลกลุ่ม CN" ? 404 : 500;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการดึงข้อมูลสรุปจุดตรวจ"
    });
  }
};

/**
 * Get MedicalItem summary (Input Group) for CNGroup
 * GET /api/v1/cngroups/:id/input-group
 */
export const getMedicalItemsSummaryForCNGroup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID CNGroup ไม่ถูกต้อง"
      });
    }

    const data = await cnGroupService.getMedicalItemsSummaryForCNGroup(id);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error("Get medical items summary for CNGroup error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการดึงข้อมูลรายการตรวจของ CNGroup"
    });
  }
};

/**
 * Delete MedicalItem (PatientExaminationItem) for CNGroup
 * DELETE /api/v1/cngroups/:id/input-group/:medicalItemId
 */
export const deleteMedicalItemForCNGroup = async (req, res) => {
  try {
    const { id, medicalItemId } = req.params;
    const userId = req.user?.id || null;

    if (!id || !medicalItemId) {
      return res.status(400).json({
        success: false,
        message: "ต้องระบุ ID CNGroup และ MedicalItem"
      });
    }

    const result = await cnGroupService.deleteMedicalItemForCNGroup(id, medicalItemId, userId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Delete medical item for CNGroup error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการลบรายการตรวจของ CNGroup"
    });
  }
};

/**
 * Delete CNGroup
 * DELETE /api/v1/cngroups/:id
 */
export const deleteCNGroup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID CNGroup ไม่ถูกต้อง"
      });
    }

    const result = await cnGroupService.deleteCNGroup(id);

    // Log system action
    await createSystemLog(req, "DELETE_CNGROUP", {
      cnGroupId: id
    });

    res.status(200).json({
      success: true,
      message: result.message || "ลบ CNGroup สำเร็จ"
    });

  } catch (error) {
    console.error("Delete CNGroup error:", error);
    
    let statusCode = 500;
    if (error.message === "ไม่พบ CNGroup ที่ระบุ") statusCode = 404;
    if (error.message.includes("ไม่สามารถลบได้")) statusCode = 400;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการลบ CNGroup"
    });
  }
};

/**
 * Get InputExam summary (ScanItem counts by station) for CNGroup
 * GET /api/v1/cngroups/:id/input-exam
 */
export const getInputExamSummaryController = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุ CNGroup ID"
      });
    }

    const stations = await cnGroupService.getInputExamSummary(id);

    res.status(200).json({
      success: true,
      data: {
        stations
      }
    });
  } catch (error) {
    console.error("Get InputExam summary error:", error);
    
    let statusCode = 500;
    if (error.message.includes("ไม่พบ CNGroup")) statusCode = 404;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการดึงข้อมูล InputExam"
    });
  }
};

/**
 * Delete InputExam (ScanItem) for CNGroup and Station
 * DELETE /api/v1/cngroups/:id/input-exam/:stationId
 */
export const deleteInputExamForStationController = async (req, res) => {
  try {
    const { id, stationId } = req.params;
    const userId = req.user?.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุ CNGroup ID"
      });
    }

    if (!stationId) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุ Station ID"
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "ไม่พบข้อมูลผู้ใช้"
      });
    }

    const result = await cnGroupService.deleteInputExamForStation(id, stationId, userId);

    // Log system action
    await createSystemLog(req, "DELETE_INPUT_EXAM", {
      cnGroupId: id,
      stationId: parseInt(stationId),
      deletedCount: result.deletedCount
    });

    res.status(200).json({
      success: true,
      data: result,
      message: result.message || "ลบข้อมูล InputExam สำเร็จ"
    });
  } catch (error) {
    console.error("Delete InputExam error:", error);
    
    let statusCode = 500;
    if (error.message.includes("ไม่พบ CNGroup")) statusCode = 404;
    if (error.message.includes("ไม่พบจุดตรวจ")) statusCode = 404;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการลบข้อมูล InputExam"
    });
  }
};

/**
 * Delete Special Checkup (PatientExaminationItem type SPECIAL) for CNGroup
 * DELETE /api/v1/cngroups/:id/special-checkup
 */
export const deleteSpecialCheckupForCNGroupController = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุ CNGroup ID"
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "ไม่พบข้อมูลผู้ใช้"
      });
    }

    const result = await cnGroupService.deleteSpecialCheckupForCNGroup(id, userId);

    // Log system action
    await createSystemLog(req, "DELETE_SPECIAL_CHECKUP", {
      cnGroupId: id,
      deletedCount: result.deletedCount
    });

    res.status(200).json({
      success: true,
      data: result,
      message: result.message || "ลบรายการตรวจพิเศษสำเร็จ"
    });
  } catch (error) {
    console.error("Delete Special Checkup error:", error);
    
    let statusCode = 500;
    if (error.message.includes("ไม่พบ CNGroup")) statusCode = 404;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการลบรายการตรวจพิเศษ"
    });
  }
};

/**
 * Delete All Input Group (PatientExaminationItem type CHECKUP) for CNGroup
 * DELETE /api/v1/cngroups/:id/input-group/all
 */
export const deleteAllInputGroupForCNGroupController = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุ CNGroup ID"
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "ไม่พบข้อมูลผู้ใช้"
      });
    }

    const result = await cnGroupService.deleteAllInputGroupForCNGroup(id, userId);

    // Log system action
    await createSystemLog(req, "DELETE_ALL_INPUT_GROUP", {
      cnGroupId: id,
      deletedCount: result.deletedCount
    });

    res.status(200).json({
      success: true,
      data: result,
      message: result.message || "ลบรายการตรวจทั้งหมดสำเร็จ"
    });
  } catch (error) {
    console.error("Delete All Input Group error:", error);
    
    let statusCode = 500;
    if (error.message.includes("ไม่พบ CNGroup")) statusCode = 404;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการลบรายการตรวจทั้งหมด"
    });
  }
};

/**
 * Delete All Input Exam (ScanItem) for CNGroup
 * DELETE /api/v1/cngroups/:id/input-exam/all
 */
export const deleteAllInputExamForCNGroupController = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "กรุณาระบุ CNGroup ID"
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "ไม่พบข้อมูลผู้ใช้"
      });
    }

    const result = await cnGroupService.deleteAllInputExamForCNGroup(id, userId);

    // Log system action
    await createSystemLog(req, "DELETE_ALL_INPUT_EXAM", {
      cnGroupId: id,
      deletedCount: result.deletedCount
    });

    res.status(200).json({
      success: true,
      data: result,
      message: result.message || "ลบข้อมูลยิงตัวอย่างทั้งหมดสำเร็จ"
    });
  } catch (error) {
    console.error("Delete All Input Exam error:", error);
    
    let statusCode = 500;
    if (error.message.includes("ไม่พบ CNGroup")) statusCode = 404;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการลบข้อมูลยิงตัวอย่างทั้งหมด"
    });
  }
};

/**
 * Get stations for active counts setting
 * GET /api/v1/cngroups/:id/stations-for-active-counts
 */
export const getStationsForActiveCounts = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID CNGroup ไม่ถูกต้อง"
      });
    }

    const result = await cnGroupService.getStationsForActiveCounts(id);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Get stations for active counts error:", error);
    
    const statusCode = error.message === "ไม่พบข้อมูลกลุ่ม CN" ? 404 : 500;
    
    res.status(statusCode).json({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดในการดึงข้อมูลจุดตรวจ"
    });
  }
};


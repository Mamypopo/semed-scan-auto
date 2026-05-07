import { prisma } from "../config/db.js";
import { safeCancelExamItems } from "../shared/exam-item-guard.js";

/**
 * Get all CNGroups
 * @param {Object} filters - Filter options
 * @returns {Array} List of CNGroups
 */
export const getAllCNGroups = async (filters = {}) => {
  const {
    isActive,
    search,
    companyId,
    source,
    page = 1,
    pageSize = 10,
    sort = 'createdAt',
    order = 'desc'
  } = filters;

  const where = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (companyId) {
    where.companyId = companyId;
  }

  if (source) {
    where.source = source;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { note: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [cnGroups, total] = await Promise.all([
    prisma.cNGroup.findMany({
      where,
      orderBy: { [sort]: order },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            taxId: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        updatedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            memberships: true
          }
        }
      },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize)
    }),
    prisma.cNGroup.count({ where })
  ]);

  return { cnGroups, total };
};

/**
 * Get CNGroups for Customer Dashboard Select
 * @param {Object} filters - Filter options { search, page, pageSize, isActive }
 * @returns {Object} { cnGroups, total, hasNextPage }
 */
export const getCNGroupsForCustomerDashboard = async (filters = {}) => {
  const {
    search,
    page = 1,
    pageSize = 20,
    isActive = true
  } = filters;

  const where = {
    isActive
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [cnGroups, total] = await Promise.all([
    prisma.cNGroup.findMany({
      where,
      orderBy: { code: 'desc' }, // เรียงตามรหัส
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
        _count: {
          select: {
            memberships: true
          }
        }
      },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize)
    }),
    prisma.cNGroup.count({ where })
  ]);

  const totalPages = Math.ceil(total / Number(pageSize));
  const hasNextPage = Number(page) < totalPages;

  return {
    cnGroups,
    total,
    page: Number(page),
    pageSize: Number(pageSize),
    totalPages,
    hasNextPage
  };
};

/**
 * Get all CNGroups for dropdown (simple list with search and limit)
 * @param {Object} filters - Filter options
 * @returns {Array} List of CNGroups for dropdown
 */
export const getAllCNGroupsForDropdown = async (filters = {}) => {
  try {
    const { search, limit = 20, companyId, isActive = true } = filters;

    const where = { isActive };

    if (companyId) {
      where.companyId = companyId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } }
      ];
    }

    const cnGroups = await prisma.cNGroup.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            memberships: true
          }
        }
      },
      orderBy: { code: 'desc' },
      take: Number(limit)
    });

    return cnGroups;
  } catch (error) {
    console.error('Error getting CNGroups for dropdown:', error);
    throw error;
  }
};

/**
 * Get CNGroup by ID
 * @param {String} id - CNGroup ID
 * @returns {Object} CNGroup data
 */
export const getCNGroupById = async (id) => {
  const cnGroup = await prisma.cNGroup.findUnique({
    where: { id },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          taxId: true
        }
      },
      createdByUser: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      updatedByUser: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      memberships: {
        select: {
          id: true,
          cn: true,
          patient: {
            select: {
              id: true,
              hn: true,
              first_name: true,
              last_name: true
            }
          }
        },
        take: 10
      },
      _count: {
        select: {
          memberships: true
        }
      }
    }
  });

  if (!cnGroup) {
    throw new Error("ไม่พบ CNGroup ที่ระบุ");
  }

  return cnGroup;
};

/**
 * Get CNGroup by ID for edit (minimal data only)
 * @param {String} id - CNGroup ID
 * @returns {Object} CNGroup minimal data
 */
export const getCNGroupByIdForEdit = async (id) => {
  const cnGroup = await prisma.cNGroup.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      code: true,
      companyId: true,
      note: true,
      includeQRCode: true,
      peNote: true,
      progressLink: true,
      isActive: true,
      comparisonDiffThresholdPercent: true,
      useWorkflow: true,
      projectStartDate: true,
      targetEndDate: true,
      taskTemplateId: true,
      taskTemplate: {
        select: {
          id: true,
          name: true,
          isActive: true,
        }
      },
    }
  });

  if (!cnGroup) {
    throw new Error("ไม่พบ CNGroup ที่ระบุ");
  }

  return cnGroup;
};

/**
 * Get distinct company names from CNGroupMembership for a specific CNGroup
 * @param {String} cnGroupId - CNGroup ID
 * @returns {Array} Array of distinct company names (strings)
 */
export const getCompanyNamesByCNGroup = async (cnGroupId) => {
  try {
    if (!cnGroupId) {
      throw new Error('CNGroup ID is required');
    }

    // ดึง distinct companyName จาก CNGroupMembership ที่มี cnGroupId ตรงกัน
    const memberships = await prisma.cNGroupMembership.groupBy({
      by: ['companyName'],
      where: {
        cnGroupId: cnGroupId,
        companyName: {
          not: null,
          not: ''
        }
      }
    });

    // แปลงเป็น array ของ string และเรียงตามชื่อ
    const companyNames = memberships
      .map(m => m.companyName)
      .filter(name => name) // กรอง null/empty
      .sort((a, b) => a.localeCompare(b, 'th')); // เรียงตามชื่อ (ภาษาไทย)

    return companyNames;
  } catch (error) {
    console.error('Error getting company names by CNGroup:', error);
    throw error;
  }
};

/**
 * Get distinct registration dates from Registration for a specific CNGroup
 * @param {String} cnGroupId - CNGroup ID
 * @returns {Array} Array of distinct registration dates (YYYY-MM-DD format)
 */
export const getRegistrationDatesByCNGroup = async (cnGroupId) => {
  try {
    if (!cnGroupId) {
      throw new Error('CNGroup ID is required');
    }

    // 1. หา CNGroupMembership IDs ทั้งหมดที่อยู่ใน CNGroup นี้
    const memberships = await prisma.cNGroupMembership.findMany({
      where: {
        cnGroupId: cnGroupId
      },
      select: {
        id: true
      }
    });

    const membershipIds = memberships.map(m => m.id);

    if (membershipIds.length === 0) {
      return [];
    }

    // 2. ดึง distinct registeredAt dates จาก Registration
    const registrations = await prisma.registration.findMany({
      where: {
        patientCNGroupId: {
          in: membershipIds
        },
        type: 'CHECKUP',
        isCancelled: false,
        registeredAt: {
          not: null
        }
      },
      select: {
        registeredAt: true
      },
      orderBy: {
        registeredAt: 'desc'
      }
    });

    // แปลงเป็น array ของ unique dates (YYYY-MM-DD format) และเรียงจากใหม่ไปเก่า
    const dateSet = new Set();
    registrations.forEach(reg => {
      if (reg.registeredAt) {
        const dateStr = new Date(reg.registeredAt).toISOString().split('T')[0];
        dateSet.add(dateStr);
      }
    });

    return Array.from(dateSet);
  } catch (error) {
    console.error('Error getting registration dates by CNGroup:', error);
    throw error;
  }
};

/**
 * Get distinct company addresses from CNGroupMembership for a specific CNGroup
 * @param {String} cnGroupId - CNGroup ID
 * @returns {Array} Array of distinct company addresses (strings)
 */
export const getCompanyAddressesByCNGroup = async (cnGroupId) => {
  try {
    if (!cnGroupId) {
      throw new Error('CNGroup ID is required');
    }

    // ดึง distinct companyAddress จาก CNGroupMembership ที่มี cnGroupId ตรงกัน
    const memberships = await prisma.cNGroupMembership.groupBy({
      by: ['companyAddress', 'companyName'],
      where: {
        cnGroupId: cnGroupId,
        companyAddress: {
          not: null,
          not: ''
        }
      }
    });

    // แปลงเป็น array ของ objects และเรียงตามชื่อบริษัทก่อนแล้วตามที่อยู่
    const companyAddresses = memberships
      .filter(m => m.companyAddress && m.companyName) // กรองที่มีทั้ง address และ companyName
      .map(m => ({
        address: m.companyAddress,
        companyName: m.companyName
      }))
      .sort((a, b) => {
        // เรียงตาม companyName ก่อน (ภาษาไทย)
        const companyCompare = a.companyName.localeCompare(b.companyName, 'th');
        if (companyCompare !== 0) return companyCompare;
        // ถ้า companyName เท่ากันค่อยเรียงตาม address
        return a.address.localeCompare(b.address, 'th');
      });

    return companyAddresses;
  } catch (error) {
    console.error('Error getting company addresses by CNGroup:', error);
    throw error;
  }
};

/**
 * Create new CNGroup
 * @param {Object} cnGroupData - CNGroup data
 * @returns {Object} Created CNGroup
 */
export const createCNGroup = async (cnGroupData) => {
  const {
    name,
    code,
    companyId,
    note,
    includeQRCode,
    peNote,
    progressLink,
    source, // 'MANUAL' | 'CRM_API'
    comparisonDiffThresholdPercent,
    createdBy,
    // Workflow fields
    useWorkflow,
    projectStartDate,
    targetEndDate,
    taskTemplateId
  } = cnGroupData;

  // Check if name already exists
  const existingCNGroup = await prisma.cNGroup.findFirst({
    where: { name }
  });

  if (existingCNGroup) {
    throw new Error("ชื่อ CNGroup นี้มีอยู่แล้ว");
  }

  const newCNGroup = await prisma.cNGroup.create({
    data: {
      name,
      code: code || null,
      companyId: companyId || null,
      note: note || null,
      includeQRCode: includeQRCode ?? true,
      peNote: peNote || null,
      progressLink: progressLink || null,
      source: source || 'MANUAL', // Default to MANUAL if not specified
      comparisonDiffThresholdPercent: comparisonDiffThresholdPercent || null,
      // Workflow fields
      useWorkflow: useWorkflow ?? false,
      projectStartDate: projectStartDate ? new Date(projectStartDate) : null,
      targetEndDate: targetEndDate ? new Date(targetEndDate) : null,
      taskTemplateId: taskTemplateId || null,
      createdBy,
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          taxId: true
        }
      },
      createdByUser: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      _count: {
        select: {
          memberships: true
        }
      }
    }
  });

  // If useWorkflow and taskTemplateId is provided, create tasks from template
  if (useWorkflow && taskTemplateId) {
    await createTasksFromTemplateInternal(newCNGroup.id, taskTemplateId, {
      projectStartDate: projectStartDate ? new Date(projectStartDate) : null,
      targetEndDate: targetEndDate ? new Date(targetEndDate) : null,
      createdAt: newCNGroup.createdAt
    }, createdBy);
  }

  return newCNGroup;
};

/**
 * Update CNGroup
 * @param {String} id - CNGroup ID
 * @param {Object} updateData - Update data
 * @returns {Object} Updated CNGroup
 */
export const updateCNGroup = async (id, updateData) => {
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
    updatedBy,
    // Workflow fields
    useWorkflow,
    projectStartDate,
    targetEndDate,
    taskTemplateId
  } = updateData;

  // Check if CNGroup exists
  const existingCNGroup = await prisma.cNGroup.findUnique({
    where: { id }
  });

  if (!existingCNGroup) {
    throw new Error("ไม่พบ CNGroup ที่ระบุ");
  }

  // Check if new name already exists (if name is being changed)
  if (name && name !== existingCNGroup.name) {
    const nameExists = await prisma.cNGroup.findFirst({
      where: {
        name,
        id: { not: id }
      }
    });

    if (nameExists) {
      throw new Error("ชื่อ CNGroup นี้มีอยู่แล้ว");
    }
  }

  // Validate and format stationActiveCounts
  let formattedStationActiveCounts = null;
  if (stationActiveCounts !== undefined) {
    if (stationActiveCounts === null || (typeof stationActiveCounts === 'object' && Object.keys(stationActiveCounts).length === 0)) {
      formattedStationActiveCounts = null;
    } else if (typeof stationActiveCounts === 'object') {
      // Validate: all values must be positive numbers
      const isValid = Object.values(stationActiveCounts).every(
        (value) => typeof value === 'number' && value > 0 && Number.isInteger(value)
      );
      if (!isValid) {
        throw new Error('stationActiveCounts ต้องเป็น object ที่มีค่าเป็นจำนวนเต็มบวกเท่านั้น');
      }
      formattedStationActiveCounts = stationActiveCounts;
    } else {
      throw new Error('stationActiveCounts ต้องเป็น object หรือ null');
    }
  }

  const updatedCNGroup = await prisma.cNGroup.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(code !== undefined && { code }),
      ...(companyId !== undefined && { companyId }),
      ...(note !== undefined && { note }),
      ...(includeQRCode !== undefined && { includeQRCode }),
      ...(peNote !== undefined && { peNote }),
      ...(progressLink !== undefined && { progressLink }),
      ...(isActive !== undefined && { isActive }),
      ...(stationActiveCounts !== undefined && { stationActiveCounts: formattedStationActiveCounts }),
      ...(comparisonDiffThresholdPercent !== undefined && { comparisonDiffThresholdPercent: comparisonDiffThresholdPercent || null }),
      // Workflow fields
      ...(useWorkflow !== undefined && { useWorkflow }),
      ...(projectStartDate !== undefined && { projectStartDate: projectStartDate ? new Date(projectStartDate) : null }),
      ...(targetEndDate !== undefined && { targetEndDate: targetEndDate ? new Date(targetEndDate) : null }),
      ...(taskTemplateId !== undefined && { taskTemplateId: taskTemplateId || null }),
      ...(updatedBy && { updatedBy }),
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          taxId: true
        }
      },
      createdByUser: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      updatedByUser: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      _count: {
        select: {
          memberships: true
        }
      }
    }
  });

  // ถ้าเปิด workflow และมี template ให้สร้าง tasks จาก template (แทนที่ของเดิม)
  if (useWorkflow && taskTemplateId) {
    await prisma.cnGroupTask.deleteMany({ where: { cnGroupId: id } });
    await createTasksFromTemplateInternal(id, taskTemplateId, {
      projectStartDate: projectStartDate ? new Date(projectStartDate) : null,
      targetEndDate: targetEndDate ? new Date(targetEndDate) : null,
      createdAt: existingCNGroup.createdAt
    }, updatedBy || existingCNGroup.updatedBy);
  }

  return updatedCNGroup;
};

/**
 * Update CNGroup active status
 * @param {String} id - CNGroup ID
 * @param {Boolean} isActive - Active status
 * @returns {Object} Updated CNGroup
 */
export const updateCNGroupActive = async (id, isActive, updatedBy) => {
  // Check if CNGroup exists
  const existingCNGroup = await prisma.cNGroup.findUnique({
    where: { id }
  });

  if (!existingCNGroup) {
    throw new Error("ไม่พบ CNGroup ที่ระบุ");
  }

  const updatedCNGroup = await prisma.cNGroup.update({
    where: { id },
    data: {
      isActive,
      ...(updatedBy && { updatedBy })
    },
    include: {
      _count: {
        select: {
          memberships: true
        }
      }
    }
  });

  return updatedCNGroup;
};

/**
 * Delete CNGroup
 * @param {String} id - CNGroup ID
 * @returns {Object} Deleted CNGroup
 */
export const deleteCNGroup = async (id) => {
  // Check if CNGroup exists
  const existingCNGroup = await prisma.cNGroup.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          memberships: true
        }
      }
    }
  });

  if (!existingCNGroup) {
    throw new Error("ไม่พบ CNGroup ที่ระบุ");
  }

  // ถ้ามี Membership ให้ลบ Membership ทั้งหมดก่อน (รวม related data)
  if (existingCNGroup._count.memberships > 0) {
    // ดึงรายการ Membership ทั้งหมด
    const memberships = await prisma.cNGroupMembership.findMany({
      where: { cnGroupId: id },
      include: {
        registrations: { select: { id: true } },
        visits: { select: { id: true } },
        patientExaminationItems: { select: { id: true } },
        healthRecords: { select: { id: true } },
        stationRemarks: { select: { id: true } }
      }
    });

    // ลบ related data ของแต่ละ Membership
    for (const membership of memberships) {
      // soft-cancel patientExaminationItems — ผลแล็บไม่หาย
      if (membership.patientExaminationItems.length > 0) {
        await safeCancelExamItems(prisma, { patientCNGroupId: membership.id });
      }

      // ลบ registrations
      if (membership.registrations.length > 0) {
        await prisma.registration.deleteMany({
          where: { patientCNGroupId: membership.id }
        });
      }
      // ลบ healthRecords
      if (membership.healthRecords.length > 0) {
        await prisma.healthRecord.deleteMany({
          where: { patientCNGroupId: membership.id }
        });
      }
      // ลบ stationRemarks
      if (membership.stationRemarks.length > 0) {
        await prisma.stationRemark.deleteMany({
          where: { patientCNGroupId: membership.id }
        });
      }
    }

    // ลบ Membership ทั้งหมด
    await prisma.cNGroupMembership.deleteMany({
      where: { cnGroupId: id }
    });
  }

  // Delete CNGroup
  await prisma.cNGroup.delete({
    where: { id }
  });

  return { success: true, message: "ลบ CNGroup และข้อมูลที่เกี่ยวข้องทั้งหมดสำเร็จ" };
};

/**
 * Get stations summary for CNGroup
 * Similar to getStationsInHNGroup but for CNGroup
 * @param {String} cnGroupId - CNGroup ID
 * @param {Array<String>} companies - Array of company names to filter (optional)
 * @returns {Object} Stations summary with counts
 */
export const getStationsInCNGroup = async (cnGroupId, companies = []) => {
  try {
    // Normalize companies parameter
    if (companies === undefined || companies === null) {
      companies = [];
    } else if (typeof companies === 'string') {
      companies = [companies];
    } else if (typeof companies === 'object' && companies !== null && typeof companies[Symbol.iterator] === 'function') {
      companies = Array.from(companies);
    } else {
      companies = [];
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. ดึงข้อมูล CNGroup
      const cnGroup = await tx.cNGroup.findUnique({
        where: { id: cnGroupId },
        select: { id: true, name: true, code: true }
      });

      if (!cnGroup) {
        throw new Error('ไม่พบข้อมูลกลุ่ม CN');
      }

      // 2. ดึงข้อมูล CNGroupMemberships และ registrations
      const membershipWhere = { cnGroupId };
      if (companies && Array.isArray(companies) && companies.length > 0) {
        membershipWhere.companyName = { in: companies };
      }

      const memberships = await tx.cNGroupMembership.findMany({
        where: membershipWhere,
        select: {
          id: true,
          patientId: true,
          registrations: {
            where: {
              type: 'CHECKUP',
              isCancelled: false
            },
            select: {
              id: true,
              registeredAt: true
            },
            take: 1 // เอาแค่ 1 รายการเพื่อเช็คว่ามีหรือไม่
          }
        }
      });

      // คำนวณจำนวนสมาชิกที่ลงทะเบียนและยังไม่ลงทะเบียน
      const registeredMemberships = memberships.filter(m =>
        m.registrations && m.registrations.length > 0
      );
      const unregisteredMemberships = memberships.filter(m =>
        !m.registrations || m.registrations.length === 0
      );

      // 3. ดึงข้อมูล PatientExaminationItems ที่เกี่ยวข้อง
      const patientExaminationItems = await tx.patientExaminationItem.findMany({
        where: {
          status: 'ACTIVE',
          patientCNGroupId: { in: memberships.map(m => m.id) },
          type: 'CHECKUP'
        },
        select: {
          id: true,
          patientCNGroupId: true,
          medicalItemId: true,
          medicalItem: {
            select: {
              id: true,
              stationToMedicalItems: {
                select: {
                  stationId: true,
                  station: {
                    select: {
                      id: true,
                      name: true,
                      priority: true,
                      isActive: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      // 4. ดึง CNGroupExpectedItems → checkupContactMap + รวบรวม stationIds จาก ExpectedItem
      const expectedItems = await tx.cNGroupExpectedItem.findMany({
        where: { cnGroupId },
        select: {
          quantity: true,
          medicalItemId: true,
          medicalItem: {
            select: {
              stationToMedicalItems: {
                select: {
                  stationId: true,
                  station: { select: { id: true, name: true, priority: true, isActive: true } }
                }
              }
            }
          }
        }
      })

      const checkupContactMap = new Map()
      const expectedStationIds = new Set()
      expectedItems.forEach(item => {
        const qty = item.quantity || 1
        item.medicalItem?.stationToMedicalItems?.forEach(stm => {
          if (!stm.station?.isActive) return
          expectedStationIds.add(stm.stationId)
          const current = checkupContactMap.get(stm.stationId) || 0
          if (qty > current) checkupContactMap.set(stm.stationId, qty)
        })
      })

      // 5. build stationMap = union ของ (stations จาก PatientExaminationItem) + (stations จาก ExpectedItem)
      const stationMap = new Map()
      const membershipMedicalItemMap = new Map()

      patientExaminationItems.forEach(item => {
        if (!item.medicalItem?.stationToMedicalItems) return
        const membershipId = item.patientCNGroupId
        if (!membershipMedicalItemMap.has(membershipId)) {
          membershipMedicalItemMap.set(membershipId, new Set())
        }
        membershipMedicalItemMap.get(membershipId).add(item.medicalItemId)

        item.medicalItem.stationToMedicalItems.forEach(stm => {
          if (!stm.station?.isActive) return
          const { id, name, priority } = stm.station
          if (!stationMap.has(id)) {
            stationMap.set(id, { id, name, priority: priority ?? 0, medicalItemIds: new Set() })
          }
          stationMap.get(id).medicalItemIds.add(item.medicalItemId)
        })
      })

      // เพิ่ม stations จาก ExpectedItem ที่ยังไม่มีใน stationMap
      if (expectedStationIds.size > 0) {
        const missingStationIds = Array.from(expectedStationIds).filter(id => !stationMap.has(id))
        if (missingStationIds.length > 0) {
          const missingStations = await tx.station.findMany({
            where: { id: { in: missingStationIds }, isActive: true },
            select: { id: true, name: true, priority: true }
          })
          missingStations.forEach(s => {
            stationMap.set(s.id, { id: s.id, name: s.name, priority: s.priority ?? 0, medicalItemIds: new Set() })
          })
        }
      }

      if (stationMap.size === 0) {
        return {
          cnGroup,
          stations: [],
          totalMemberships: memberships.length,
          registeredMemberships: registeredMemberships.length,
          unregisteredMemberships: unregisteredMemberships.length,
        }
      }

      // 5. ดึงข้อมูล ScanItems
      const stationIds = Array.from(stationMap.keys());
      const scanItems = await tx.scanItem.findMany({
        where: {
          stationId: { in: stationIds },
          isCancelled: false,
          registration: {
            patientCNGroup: {
              cnGroupId: cnGroupId,
              ...(companies && Array.isArray(companies) && companies.length > 0
                ? { companyName: { in: companies } }
                : {})
            },
            type: 'CHECKUP',
            isCancelled: false
          }
        },
        select: {
          stationId: true,
          registration: {
            select: {
              patientCNGroupId: true
            }
          }
        }
      });

      // สร้าง scan map: stationId -> Set<membershipId>
      const scanMap = new Map();
      scanItems.forEach(scan => {
        const stationId = scan.stationId;
        const membershipId = scan.registration?.patientCNGroupId;
        if (!membershipId) return;

        if (!scanMap.has(stationId)) {
          scanMap.set(stationId, new Set());
        }
        scanMap.get(stationId).add(membershipId);
      });

      // 6. คำนวณสถิติของแต่ละ station
      const stations = Array.from(stationMap.values()).map(station => {
        const stationMedicalItemIds = station.medicalItemIds;

        // หา memberships ที่ควรไป station นี้ (มี medicalItem ที่เชื่อมกับ station นี้)
        const requiredMembershipIds = memberships
          .filter(m => {
            const membershipMedicalItems = membershipMedicalItemMap.get(m.id) || new Set();
            return Array.from(stationMedicalItemIds).some(itemId => membershipMedicalItems.has(itemId));
          })
          .map(m => m.id);

        // หา memberships ที่ลงทะเบียนแล้วและควรไป station นี้
        const registeredRequiredMembershipIds = registeredMemberships
          .filter(m => {
            const membershipMedicalItems = membershipMedicalItemMap.get(m.id) || new Set();
            return Array.from(stationMedicalItemIds).some(itemId => membershipMedicalItems.has(itemId));
          })
          .map(m => m.id);

        // คำนวณจำนวนที่สแกนแล้ว
        const scannedMembershipIds = scanMap.get(station.id) || new Set();
        const scannedCount = requiredMembershipIds.filter(id => scannedMembershipIds.has(id)).length;
        const notScannedCount = registeredRequiredMembershipIds.filter(id => !scannedMembershipIds.has(id)).length;

        return {
          id: station.id,
          name: station.name,
          membershipCount: requiredMembershipIds.length,
          scannedCount,
          notScannedCount,
          checkupContact: checkupContactMap.get(station.id) || 0
        };
      });

      // เรียงตาม priority (priority=0 อยู่หลังสุด), ถ้าเท่ากันเรียงตามชื่อ
      stations.sort((a, b) => {
        const stationA = stationMap.get(a.id);
        const stationB = stationMap.get(b.id);
        const priorityA = stationA?.priority === 0 ? Infinity : (stationA?.priority || 0);
        const priorityB = stationB?.priority === 0 ? Infinity : (stationB?.priority || 0);

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        return a.name.localeCompare(b.name, 'th');
      });

      return {
        cnGroup,
        stations,
        totalMemberships: memberships.length,
        registeredMemberships: registeredMemberships.length,
        unregisteredMemberships: unregisteredMemberships.length,
      };
    });

    return result;
  } catch (error) {
    console.error('Error in getStationsInCNGroup:', error);
    throw error;
  }
};

/**
 * สรุปรายการตรวจ (MedicalItem) ใน CNGroup (ใช้สำหรับจัดการ Input Group)
 * นับจาก PatientExaminationItem ที่ผูกกับ CNGroupMembership ของ CNGroup นั้น
 */
export const getMedicalItemsSummaryForCNGroup = async (cnGroupId) => {
  try {
    return await prisma.$transaction(async (tx) => {
      // 1) หาสมาชิกใน CNGroup นี้ก่อน
      const memberships = await tx.cNGroupMembership.findMany({
        where: { cnGroupId },
        select: { id: true },
      });

      if (memberships.length === 0) {
        return [];
      }

      const membershipIds = memberships.map((m) => m.id);

      // 2) groupBy PatientExaminationItem ตาม medicalItemId
      const peiGroups = await tx.patientExaminationItem.groupBy({
        by: ['medicalItemId'],
        where: {
          patientCNGroupId: { in: membershipIds },
          type: 'CHECKUP',
        },
        _count: {
          medicalItemId: true,
        },
      });

      if (peiGroups.length === 0) {
        return [];
      }

      const medicalItemIds = peiGroups.map((g) => g.medicalItemId);

      // 3) ดึงข้อมูล MedicalItem ที่เกี่ยวข้อง
      const medicalItems = await tx.medicalItem.findMany({
        where: {
          id: { in: medicalItemIds },
        },
        select: {
          id: true,
          name: true,
          nameEn: true,
          code: true,
          priority: true,
        },
        orderBy: [
          { priority: 'asc' },
          { name: 'asc' },
        ],
      });

      const itemMap = new Map(medicalItems.map((m) => [m.id, m]));

      const result = peiGroups.map((g) => {
        const item = itemMap.get(g.medicalItemId);
        return {
          medicalItemId: g.medicalItemId,
          medicalItemName: item?.name || 'ไม่พบชื่อรายการตรวจ',
          medicalItemNameEn: item?.nameEn || '',
          medicalItemCode: item?.code || '',
          membershipCount: g._count.medicalItemId,
          priority: item?.priority ?? 0,
        };
      });

      // เรียงตาม priority (0 ไปท้ายสุด) แล้วตามชื่อ
      result.sort((a, b) => {
        const priorityA = a.priority === 0 ? Infinity : a.priority;
        const priorityB = b.priority === 0 ? Infinity : b.priority;

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        return a.medicalItemName.localeCompare(b.medicalItemName, 'th');
      });

      return result;
    });
  } catch (error) {
    console.error('Error in getMedicalItemsSummaryForCNGroup:', error);
    throw error;
  }
};

/**
 * ลบ PatientExaminationItem ของ MedicalItem หนึ่งตัวสำหรับสมาชิกทุกคนใน CNGroup
 * ใช้สำหรับปุ่ม "ลบรายการตรวจ" ในหน้าจัดการ Input Group
 */
export const deleteMedicalItemForCNGroup = async (cnGroupId, medicalItemId, userId) => {
  try {
    return await prisma.$transaction(async (tx) => {
      // validate medical item
      const medicalItem = await tx.medicalItem.findUnique({
        where: { id: medicalItemId },
        select: { id: true, name: true },
      });

      if (!medicalItem) {
        throw new Error('ไม่พบรายการตรวจที่ต้องการลบ');
      }

      // memberships
      const memberships = await tx.cNGroupMembership.findMany({
        where: { cnGroupId },
        select: { id: true },
      });

      if (memberships.length === 0) {
        return {
          deletedCount: 0,
          message: 'ไม่มีสมาชิกใน CNGroup นี้',
          medicalItemName: medicalItem.name,
        };
      }

      const membershipIds = memberships.map((m) => m.id);

      const { cancelledCount: cancelledCount1 } = await safeCancelExamItems(tx, {
        medicalItemId,
        type: 'CHECKUP',
        patientCNGroupId: { in: membershipIds },
      });
      const deleteResult = { count: cancelledCount1 };

      return {
        deletedCount: deleteResult.count,
        message: `ลบรายการตรวจ ${medicalItem.name} จำนวน ${deleteResult.count} รายการเรียบร้อยแล้ว`,
        medicalItemName: medicalItem.name,
      };
    });
  } catch (error) {
    console.error('Error in deleteMedicalItemForCNGroup:', error);
    throw error;
  }
};

/**
 * ดึงสรุปข้อมูล InputExam (ScanItem) แยกตาม Station สำหรับ CNGroup
 * @param {string} cnGroupId - CNGroup ID
 * @returns {Promise<Array>} Array of { stationId, stationName, scanCount, priority }
 */
export const getInputExamSummary = async (cnGroupId) => {
  try {
    // 1. ตรวจสอบว่า CNGroup มีอยู่จริง
    const cnGroup = await prisma.cNGroup.findUnique({
      where: { id: cnGroupId },
      select: { id: true, name: true, code: true },
    });

    if (!cnGroup) {
      throw new Error(`ไม่พบ CNGroup รหัส ${cnGroupId}`);
    }

    // 2. ดึง membershipIds ทั้งหมดใน CNGroup นี้
    const memberships = await prisma.cNGroupMembership.findMany({
      where: { cnGroupId },
      select: { id: true },
    });

    if (memberships.length === 0) {
      return [];
    }

    const membershipIds = memberships.map((m) => m.id);

    // 3. ดึง ScanItem ที่เชื่อมกับ Registration ที่มี patientCNGroupId ใน membershipIds
    // และ type = 'CHECKUP', isCancelled = false
    const scanItems = await prisma.scanItem.findMany({
      where: {
        registration: {
          patientCNGroupId: { in: membershipIds },
          type: 'CHECKUP',
          isCancelled: false,
        },
        isCancelled: false,
      },
      select: {
        stationId: true,
      },
    });

    if (scanItems.length === 0) {
      return [];
    }

    // 4. นับจำนวน ScanItem แยกตาม stationId
    const stationCounts = new Map();
    scanItems.forEach((item) => {
      const count = stationCounts.get(item.stationId) || 0;
      stationCounts.set(item.stationId, count + 1);
    });

    // 5. ดึงข้อมูล Station (id, name, priority)
    const stationIds = Array.from(stationCounts.keys());
    const stations = await prisma.station.findMany({
      where: { id: { in: stationIds } },
      select: { id: true, name: true, priority: true },
    });

    const stationMap = new Map(
      stations.map((s) => [s.id, { name: s.name, priority: s.priority || 0 }])
    );

    // 6. ประกอบข้อมูลและเรียงตาม priority
    const result = Array.from(stationCounts.entries()).map(([stationId, scanCount]) => ({
      stationId,
      stationName: stationMap.get(stationId)?.name || 'ไม่พบชื่อจุดตรวจ',
      scanCount,
      priority: stationMap.get(stationId)?.priority || 0,
    }));

    // เรียงตาม priority (priority 0 จะอยู่หลังสุด)
    result.sort((a, b) => {
      const priorityA = a.priority === 0 ? Infinity : a.priority;
      const priorityB = b.priority === 0 ? Infinity : b.priority;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // ถ้า priority เท่ากัน ให้เรียงตามชื่อ
      return a.stationName.localeCompare(b.stationName, 'th');
    });

    return result;
  } catch (error) {
    console.error('Error in getInputExamSummary:', error);
    throw error;
  }
};

/**
 * ลบข้อมูล InputExam (ScanItem) สำหรับ CNGroup และ Station
 * @param {string} cnGroupId - CNGroup ID
 * @param {number} stationId - Station ID
 * @param {number} userId - User ID ที่ทำการลบ
 * @returns {Promise<object>} { deletedCount, message }
 */
export const deleteInputExamForStation = async (cnGroupId, stationId, userId) => {
  try {
    // 1. ตรวจสอบว่า CNGroup มีอยู่จริง
    const cnGroup = await prisma.cNGroup.findUnique({
      where: { id: cnGroupId },
      select: { id: true, name: true },
    });

    if (!cnGroup) {
      throw new Error(`ไม่พบ CNGroup รหัส ${cnGroupId}`);
    }

    // 2. ตรวจสอบว่า Station มีอยู่จริง
    const station = await prisma.station.findUnique({
      where: { id: parseInt(stationId) },
      select: { id: true, name: true },
    });

    if (!station) {
      throw new Error(`ไม่พบจุดตรวจรหัส ${stationId}`);
    }

    // 3. ดึง membershipIds ทั้งหมดใน CNGroup นี้
    const memberships = await prisma.cNGroupMembership.findMany({
      where: { cnGroupId },
      select: { id: true },
    });

    if (memberships.length === 0) {
      return {
        deletedCount: 0,
        message: 'ไม่มีสมาชิกใน CNGroup นี้',
      };
    }

    const membershipIds = memberships.map((m) => m.id);

    // 4. Soft delete ScanItem ทั้งหมดที่ตรงกับเงื่อนไข
    const result = await prisma.scanItem.updateMany({
      where: {
        stationId: parseInt(stationId),
        registration: {
          patientCNGroupId: { in: membershipIds },
          type: 'CHECKUP',
          isCancelled: false,
        },
        isCancelled: false,
      },
      data: {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledBy: userId,
      },
    });

    return {
      deletedCount: result.count,
      message: `ลบข้อมูลยิงตัวอย่างของจุดตรวจ ${station.name} จำนวน ${result.count} รายการเรียบร้อยแล้ว`,
      stationName: station.name,
    };
  } catch (error) {
    console.error('Error in deleteInputExamForStation:', error);
    throw error;
  }
};

/**
 * ลบรายการตรวจพิเศษ (PatientExaminationItem type SPECIAL) ทั้งหมดสำหรับ CNGroup
 * @param {string} cnGroupId - CNGroup ID
 * @param {number} userId - User ID ที่ทำการลบ
 * @returns {Promise<object>} { deletedCount, message }
 */
export const deleteSpecialCheckupForCNGroup = async (cnGroupId, userId) => {
  try {
    // 1. ตรวจสอบว่า CNGroup มีอยู่จริง
    const cnGroup = await prisma.cNGroup.findUnique({
      where: { id: cnGroupId },
      select: { id: true, name: true },
    });

    if (!cnGroup) {
      throw new Error(`ไม่พบ CNGroup รหัส ${cnGroupId}`);
    }

    // 2. ดึง membershipIds ทั้งหมดใน CNGroup นี้
    const memberships = await prisma.cNGroupMembership.findMany({
      where: { cnGroupId },
      select: { id: true },
    });

    if (memberships.length === 0) {
      return {
        deletedCount: 0,
        message: 'ไม่มีสมาชิกใน CNGroup นี้',
      };
    }

    const membershipIds = memberships.map((m) => m.id);

    // 3. soft-cancel PatientExaminationItem ที่ type = 'SPECIAL' ทั้งหมด
    const { cancelledCount: specialCancelledCount } = await safeCancelExamItems(prisma, {
      patientCNGroupId: { in: membershipIds },
      type: 'SPECIAL',
    });

    return {
      deletedCount: specialCancelledCount,
      message: `ยกเลิกรายการตรวจพิเศษทั้งหมดจำนวน ${specialCancelledCount} รายการเรียบร้อยแล้ว`,
    };
  } catch (error) {
    console.error('Error in deleteSpecialCheckupForCNGroup:', error);
    throw error;
  }
};

/**
 * ลบรายการตรวจ (PatientExaminationItem type CHECKUP) ทั้งหมดสำหรับ CNGroup
 * @param {string} cnGroupId - CNGroup ID
 * @param {number} userId - User ID ที่ทำการลบ
 * @returns {Promise<object>} { deletedCount, message }
 */
export const deleteAllInputGroupForCNGroup = async (cnGroupId, userId) => {
  try {
    // 1. ตรวจสอบว่า CNGroup มีอยู่จริง
    const cnGroup = await prisma.cNGroup.findUnique({
      where: { id: cnGroupId },
      select: { id: true, name: true },
    });

    if (!cnGroup) {
      throw new Error(`ไม่พบ CNGroup รหัส ${cnGroupId}`);
    }

    // 2. ดึง membershipIds ทั้งหมดใน CNGroup นี้
    const memberships = await prisma.cNGroupMembership.findMany({
      where: { cnGroupId },
      select: { id: true },
    });

    if (memberships.length === 0) {
      return {
        deletedCount: 0,
        message: 'ไม่มีสมาชิกใน CNGroup นี้',
      };
    }

    const membershipIds = memberships.map((m) => m.id);

    // 3. soft-cancel PatientExaminationItem ที่ type = 'CHECKUP' ทั้งหมด
    const { cancelledCount: checkupCancelledCount } = await safeCancelExamItems(prisma, {
      patientCNGroupId: { in: membershipIds },
      type: 'CHECKUP',
    });

    return {
      deletedCount: checkupCancelledCount,
      message: `ยกเลิกรายการตรวจทั้งหมดจำนวน ${checkupCancelledCount} รายการเรียบร้อยแล้ว`,
    };
  } catch (error) {
    console.error('Error in deleteAllInputGroupForCNGroup:', error);
    throw error;
  }
};

/**
 * ลบข้อมูลยิงตัวอย่าง (ScanItem) ทั้งหมดสำหรับ CNGroup
 * @param {string} cnGroupId - CNGroup ID
 * @param {number} userId - User ID ที่ทำการลบ
 * @returns {Promise<object>} { deletedCount, message }
 */
export const deleteAllInputExamForCNGroup = async (cnGroupId, userId) => {
  try {
    // 1. ตรวจสอบว่า CNGroup มีอยู่จริง
    const cnGroup = await prisma.cNGroup.findUnique({
      where: { id: cnGroupId },
      select: { id: true, name: true },
    });

    if (!cnGroup) {
      throw new Error(`ไม่พบ CNGroup รหัส ${cnGroupId}`);
    }

    // 2. ดึง membershipIds ทั้งหมดใน CNGroup นี้
    const memberships = await prisma.cNGroupMembership.findMany({
      where: { cnGroupId },
      select: { id: true },
    });

    if (memberships.length === 0) {
      return {
        deletedCount: 0,
        message: 'ไม่มีสมาชิกใน CNGroup นี้',
      };
    }

    const membershipIds = memberships.map((m) => m.id);

    // 3. Soft delete ScanItem ทั้งหมดที่ตรงกับเงื่อนไข
    const result = await prisma.scanItem.updateMany({
      where: {
        registration: {
          patientCNGroupId: { in: membershipIds },
          type: 'CHECKUP',
          isCancelled: false,
        },
        isCancelled: false,
      },
      data: {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledBy: userId,
      },
    });

    return {
      deletedCount: result.count,
      message: `ลบข้อมูลยิงตัวอย่างทั้งหมดจำนวน ${result.count} รายการเรียบร้อยแล้ว`,
    };
  } catch (error) {
    console.error('Error in deleteAllInputExamForCNGroup:', error);
    throw error;
  }
};

/**
 * ดึง Station ที่เกี่ยวข้องกับ CNGroup สำหรับตั้งค่าจำนวนจุดตรวจ
 * ดึงจาก PatientExaminationItem → MedicalItem → StationToMedicalItem → Station
 * @param {string} cnGroupId - CNGroup ID
 * @returns {Promise<Object>} { stations: Array, stationActiveCounts: Object }
 */
export const getStationsForActiveCounts = async (cnGroupId) => {
  try {
    // 1. ตรวจสอบว่า CNGroup มีอยู่จริง
    const cnGroup = await prisma.cNGroup.findUnique({
      where: { id: cnGroupId },
      select: { id: true, name: true, stationActiveCounts: true }
    });

    if (!cnGroup) {
      throw new Error('ไม่พบข้อมูลกลุ่ม CN');
    }

    // 2. ดึง membershipIds ทั้งหมดใน CNGroup นี้
    const memberships = await prisma.cNGroupMembership.findMany({
      where: { cnGroupId },
      select: { id: true }
    });

    if (memberships.length === 0) {
      return {
        stations: [],
        stationActiveCounts: cnGroup.stationActiveCounts || {}
      };
    }

    const membershipIds = memberships.map((m) => m.id);

    // 3. ดึง PatientExaminationItems ที่เกี่ยวข้อง
    const patientExaminationItems = await prisma.patientExaminationItem.findMany({
      where: {
        status: 'ACTIVE',
        patientCNGroupId: { in: membershipIds },
        type: 'CHECKUP'
      },
      select: {
        medicalItemId: true,
        medicalItem: {
          select: {
            id: true,
            stationToMedicalItems: {
              select: {
                stationId: true,
                station: {
                  select: {
                    id: true,
                    name: true,
                    priority: true,
                    isActive: true
                  }
                }
              }
            }
          }
        }
      },
      distinct: ['medicalItemId'] // เอาแค่ unique medicalItemId
    });

    if (patientExaminationItems.length === 0) {
      return {
        stations: [],
        stationActiveCounts: cnGroup.stationActiveCounts || {}
      };
    }

    // 4. สร้าง Set ของ Station IDs (unique)
    const stationSet = new Map();
    patientExaminationItems.forEach((pei) => {
      if (pei.medicalItem?.stationToMedicalItems) {
        pei.medicalItem.stationToMedicalItems.forEach((stmi) => {
          if (stmi.station && stmi.station.isActive) {
            const stationId = String(stmi.station.id);
            if (!stationSet.has(stationId)) {
              stationSet.set(stationId, {
                id: stmi.station.id,
                name: stmi.station.name,
                priority: stmi.station.priority ?? 9999,
                isActive: stmi.station.isActive
              });
            }
          }
        });
      }
    });

    // 5. แปลงเป็น Array และเรียงตาม priority (priority=0 อยู่หลังสุด), ถ้าเท่ากันเรียงตามชื่อ
    const stations = Array.from(stationSet.values()).sort((a, b) => {
      const priorityA = a.priority === 0 ? Infinity : (a.priority ?? 9999);
      const priorityB = b.priority === 0 ? Infinity : (b.priority ?? 9999);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return a.name.localeCompare(b.name);
    });

    // 6. เพิ่ม activeCount จาก stationActiveCounts
    const stationActiveCounts = cnGroup.stationActiveCounts || {};
    const stationsWithActiveCount = stations.map((station) => {
      const stationId = String(station.id);
      const activeCount = stationActiveCounts[stationId] || 1; // default = 1
      return {
        ...station,
        activeCount: typeof activeCount === 'number' && activeCount > 0 ? activeCount : 1
      };
    });

    return {
      stations: stationsWithActiveCount,
      stationActiveCounts: stationActiveCounts
    };
  } catch (error) {
    console.error('Error in getStationsForActiveCounts:', error);
    throw error;
  }
};

/**
 * Create CnGroupTasks from TaskTemplate
 * @param {String} cnGroupId - CNGroup ID
 * @param {String} taskTemplateId - TaskTemplate ID
 * @param {String} targetEndDate - Target end date
 * @param {Number} userId - User ID who created
 */
/**
 * สร้าง tasks จาก Template
 * - Dynamic Scaling: TotalTime = targetEndDate - startDate, Multiplier = TotalTime / TemplateSum(leadTimeDays)
 *   แต่ละ task ได้เวลา = leadTimeDays × Multiplier → task สุดท้ายลงล็อกเป๊ะที่ targetEndDate
 * - มี projectStartDate: ใช้เป็นวันเริ่ม แล้วใช้ Multiplier
 * - ไม่มี projectStartDate แต่มี targetEndDate: ใช้วันที่สร้างรายการ (createdAt) หรือวันปัจจุบันเป็นวันเริ่ม แล้วใช้ Multiplier → เห็นภาพ "ถ้าเริ่มวันนี้ จะต้องเร่งงานแค่ไหนให้ทันส่ง"
 */
const createTasksFromTemplateInternal = async (cnGroupId, taskTemplateId, options, userId) => {
  try {
    const { projectStartDate: optStart, targetEndDate, createdAt } = typeof options === 'object' && options !== null
      ? options
      : { projectStartDate: null, targetEndDate: options, createdAt: null }

    const template = await prisma.taskTemplate.findUnique({
      where: { id: taskTemplateId }
    });

    if (!template || !template.steps) {
      console.warn('Template not found or has no steps');
      return;
    }

    const steps = Array.isArray(template.steps) ? template.steps : [];
    const sortedSteps = [...steps].sort((a, b) => (a.order || 0) - (b.order || 0));

    const totalLeadDays = sortedSteps.reduce(
      (sum, s) => sum + (typeof s.leadTimeDays === 'number' ? s.leadTimeDays : s.leadTimeDays ? parseInt(s.leadTimeDays, 10) : 1),
      0
    );

    const endDate = targetEndDate ? new Date(targetEndDate) : null;

    // วันเริ่ม: มี projectStartDate ใช้นั้น, ไม่มีแต่มี targetEndDate ใช้ createdAt หรือวันนี้ (เห็นภาพ "เริ่มวันนี้ ต้องเร่งแค่ไหนให้ทันส่ง")
    let startDate = null;
    if (optStart) {
      startDate = new Date(optStart);
    } else if (endDate) {
      startDate = createdAt ? new Date(createdAt) : new Date();
    }

    // ปรับเวลาเป็นเที่ยงคืนเพื่อคำนวณวันให้ตรง
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(0, 0, 0, 0);

    const dueDates = [];

    if (startDate && endDate && totalLeadDays > 0) {
      // Dynamic Scaling: กระจายวันตามสัดส่วน leadTimeDays ให้จบเป๊ะที่ targetEndDate
      const totalTimeDays = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      const multiplier = totalTimeDays / totalLeadDays;
      let cumulativeScaled = 0;
      for (let i = 0; i < sortedSteps.length; i++) {
        const step = sortedSteps[i];
        const days = typeof step.leadTimeDays === 'number' ? step.leadTimeDays : (step.leadTimeDays ? parseInt(step.leadTimeDays, 10) : 1);
        cumulativeScaled += days * multiplier;
        const due = new Date(startDate);
        due.setDate(due.getDate() + Math.round(cumulativeScaled));
        due.setHours(0, 0, 0, 0);
        dueDates.push(due);
      }
      dueDates[dueDates.length - 1] = new Date(endDate);
      dueDates[dueDates.length - 1].setHours(0, 0, 0, 0);
    } else {
      // Fallback: ไม่มี endDate (ไม่นเกิด) ใช้ sequential จาก startDate หรือ due = null
      let cumulativeDays = 0;
      for (const step of sortedSteps) {
        const days = typeof step.leadTimeDays === 'number' ? step.leadTimeDays : (step.leadTimeDays ? parseInt(step.leadTimeDays, 10) : 1);
        cumulativeDays += days;
        let due = null;
        if (startDate) {
          due = new Date(startDate);
          due.setDate(due.getDate() + cumulativeDays);
          due.setHours(0, 0, 0, 0);
        }
        dueDates.push(due);
      }
    }

    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];
      await prisma.cnGroupTask.create({
        data: {
          cnGroupId,
          taskName: step.name,
          status: 'TODO',
          order: step.order || 1,
          dependsOnOrder: step.dependsOnOrder || null,
          dueDate: dueDates[i],
          leadTimeDays: step.leadTimeDays != null ? step.leadTimeDays : null,
          createdBy: userId
        }
      });
    }

    console.log(`Created ${sortedSteps.length} tasks from template for CNGroup ${cnGroupId} (Dynamic Scaling: last task = targetEndDate)`);
  } catch (error) {
    console.error('Error creating tasks from template:', error);
    throw error;
  }
};


import { prisma } from '../config/db.js'

/**
 * ดึงรายการ RemarkReason ทั้งหมด
 * @param {object} params - { page, limit, search, sortBy, sortOrder, isActive }
 * @returns {Promise<object>} รายการ RemarkReason พร้อม pagination
 */
export const getAllRemarkReasons = async (params = {}) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      isActive
    } = params

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const where = {}

    // ค้นหาตามชื่อ
    if (search) {
      where.title = {
        contains: search.trim(),
        mode: 'insensitive'
      }
    }

    // กรองตามสถานะ
    if (isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true' || isActive === true
    }

    // เรียงลำดับ
    const validSortFields = ['title', 'createdAt', 'updatedAt']
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt'

    const orderBy = {}
    orderBy[finalSortBy] = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc'

    // ดึงข้อมูลพร้อมกัน
    const [remarkReasons, total, activeCount, inactiveCount] = await Promise.all([
      prisma.remarkReason.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        include: {
          createdByUser: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),
      prisma.remarkReason.count({ where }),
      prisma.remarkReason.count({
        where: {
          ...where,
          isActive: true
        }
      }),
      prisma.remarkReason.count({
        where: {
          ...where,
          isActive: false
        }
      })
    ])

    const totalPages = Math.ceil(total / limitNum)
    const hasNextPage = pageNum < totalPages
    const hasPrevPage = pageNum > 1

    return {
      data: remarkReasons,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage
      },
      summary: {
        active: activeCount,
        inactive: inactiveCount,
        total
      }
    }
  } catch (error) {
    console.error('❌ Get All Remark Reasons Service Error:', error)
    throw error
  }
}

/**
 * ดึง RemarkReason ตาม ID (ใช้ภายในเท่านั้น)
 * @param {string} id - RemarkReason ID
 * @returns {Promise<object>} RemarkReason
 */
export const getRemarkReasonById = async (id) => {
  try {
    return await prisma.remarkReason.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  } catch (error) {
    console.error('❌ Get Remark Reason By ID Service Error:', error)
    throw error
  }
}

/**
 * ตรวจสอบชื่อซ้ำ
 * @param {string} title - ชื่อเหตุผล
 * @param {string} excludeId - ID ที่จะยกเว้น (สำหรับการแก้ไข)
 * @returns {Promise<object|null>} RemarkReason ที่ซ้ำ หรือ null
 */
export const checkDuplicateTitle = async (title, excludeId = null) => {
  try {
    const where = {
      title: title.trim(),
      isActive: true
    }

    if (excludeId) {
      where.id = { not: excludeId }
    }

    return await prisma.remarkReason.findFirst({ where })
  } catch (error) {
    console.error('❌ Check Duplicate Title Service Error:', error)
    throw error
  }
}

/**
 * สร้าง RemarkReason ใหม่
 * @param {object} data - { title, isDefault, createdBy }
 * @returns {Promise<object>} RemarkReason ที่สร้าง
 */
export const createRemarkReason = async (data) => {
  try {
    const { title, isDefault = false, createdBy } = data

    // ถ้า isDefault = true ให้ตรวจสอบว่ามี default อยู่แล้วหรือไม่
    if (isDefault) {
      const existingDefault = await prisma.remarkReason.findFirst({
        where: {
          isDefault: true,
          isActive: true
        }
      })

      if (existingDefault) {
        throw new Error(`มีเหตุผลเริ่มต้นอยู่แล้ว: "${existingDefault.title}"`)
      }
    }

    return await prisma.remarkReason.create({
      data: {
        title: title.trim(),
        isDefault,
        isActive: true,
        createdBy: createdBy ? parseInt(createdBy) : null
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  } catch (error) {
    console.error('❌ Create Remark Reason Service Error:', error)
    throw error
  }
}

/**
 * ดึง RemarkReason ที่เป็น default
 * @returns {Promise<object|null>} Default RemarkReason หรือ null
 */
export const getDefaultReason = async () => {
  try {
    return await prisma.remarkReason.findFirst({
      where: {
        isDefault: true,
        isActive: true
      }
    })
  } catch (error) {
    console.error('❌ Get Default Reason Service Error:', error)
    throw error
  }
}

/**
 * อัปเดต RemarkReason
 * @param {string} id - RemarkReason ID
 * @param {object} data - { title, isDefault }
 * @returns {Promise<object>} RemarkReason ที่อัปเดต
 */
export const updateRemarkReason = async (id, data) => {
  try {
    const { title, isDefault } = data

    // ถ้า isDefault = true ให้ตรวจสอบว่ามี default อยู่แล้วหรือไม่ (ยกเว้นตัวเอง)
    if (isDefault) {
      const existingDefault = await prisma.remarkReason.findFirst({
        where: {
          isDefault: true,
          isActive: true,
          id: { not: id }
        }
      })

      if (existingDefault) {
        throw new Error(`มีเหตุผลเริ่มต้นอยู่แล้ว: "${existingDefault.title}"`)
      }
    }

    return await prisma.remarkReason.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(isDefault !== undefined && { isDefault }),
        updatedAt: new Date()
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  } catch (error) {
    console.error('❌ Update Remark Reason Service Error:', error)
    throw error
  }
}

/**
 * Toggle สถานะ RemarkReason
 * @param {string} id - RemarkReason ID
 * @returns {Promise<object>} RemarkReason ที่อัปเดต
 */
export const toggleRemarkReasonStatus = async (id) => {
  try {
    const current = await prisma.remarkReason.findUnique({
      where: { id },
      select: {
        isActive: true,
        title: true
      }
    })

    if (!current) {
      throw new Error('ไม่พบเหตุผลที่ระบุ')
    }

    // ถ้าจะปิดใช้งาน ให้ตรวจสอบการใช้งานก่อน
    if (current.isActive) {
      const usageCount = await prisma.stationRemark.count({
        where: {
          reasonId: id
        }
      })

      if (usageCount > 0) {
        throw new Error('ไม่สามารถปิดใช้งานเหตุผลนี้ได้ เนื่องจากมีการใช้งานอยู่')
      }
    }

    return await prisma.remarkReason.update({
      where: { id },
      data: {
        isActive: !current.isActive,
        updatedAt: new Date()
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  } catch (error) {
    console.error('❌ Toggle Remark Reason Status Service Error:', error)
    throw error
  }
}


/**
 * ดึงรายการ RemarkReason ที่ใช้งานได้ (สำหรับ dropdown)
 * @returns {Promise<Array>} รายการ RemarkReason ที่ active
 */
export const getActiveRemarkReasons = async () => {
  try {
    return await prisma.remarkReason.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        title: 'asc'
      },
      select: {
        id: true,
        title: true,
        isDefault: true
      }
    })
  } catch (error) {
    console.error('❌ Get Active Remark Reasons Service Error:', error)
    throw error
  }
}



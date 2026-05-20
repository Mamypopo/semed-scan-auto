import * as remarkReasonService from './remark-reason.service.js'
import { createSystemLog } from '../utils/logger.js'

/**
 * ดึงรายการ RemarkReason ทั้งหมด
 */
export const getRemarkReasons = async (req, res) => {
  try {
    const result = await remarkReasonService.getAllRemarkReasons(req.query)
    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('❌ Get Remark Reasons Controller Error:', error.message)
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลเหตุผล'
    })
  }
}


/**
 * เพิ่ม RemarkReason ใหม่
 */
export const createRemarkReason = async (req, res) => {
  try {
    const { title, isDefault = false } = req.body
    const userId = req.user?.id

    if (!title || title.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุชื่อเหตุผล'
      })
    }

    // ตรวจสอบชื่อซ้ำ
    const existingReason = await remarkReasonService.checkDuplicateTitle(title)
    if (existingReason) {
      return res.status(400).json({
        success: false,
        message: 'มีเหตุผลนี้อยู่แล้วในระบบ'
      })
    }

    const remarkReason = await remarkReasonService.createRemarkReason({
      title,
      isDefault,
      createdBy: userId
    })

    // บันทึก log
    if (userId) {
      await createSystemLog(
        req,
        'CREATE_REMARK_REASON',
        `สร้างเหตุผลขาดตรวจใหม่: ${title.trim()}${isDefault ? ' (เป็นเหตุผลขาดตรวจเริ่มต้น)' : ''}`,
        null,
        null
      )
    }

    res.status(201).json({
      success: true,
      data: remarkReason,
      message: 'สร้างเหตุผลสำเร็จ'
    })
  } catch (error) {
    console.error('❌ Create Remark Reason Controller Error:', error.message)
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการสร้างเหตุผล'
    })
  }
}

/**
 * แก้ไข RemarkReason
 */
export const updateRemarkReason = async (req, res) => {
  try {
    const { id } = req.params
    const { title, isDefault } = req.body
    const userId = req.user?.id

    if (!title || title.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุชื่อเหตุผล'
      })
    }

    // ตรวจสอบว่ามี RemarkReason อยู่หรือไม่
    const existingReason = await remarkReasonService.getRemarkReasonById(id)
    if (!existingReason) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบเหตุผลที่ระบุ'
      })
    }

    // ตรวจสอบชื่อซ้ำ (ยกเว้นตัวเอง)
    const duplicateReason = await remarkReasonService.checkDuplicateTitle(title, id)
    if (duplicateReason) {
      return res.status(400).json({
        success: false,
        message: 'มีเหตุผลนี้อยู่แล้วในระบบ'
      })
    }

    const updatedReason = await remarkReasonService.updateRemarkReason(id, {
      title,
      isDefault
    })

    // บันทึก log
    if (userId) {
      await createSystemLog(
        req,
        'UPDATE_REMARK_REASON',
        `แก้ไขเหตุผล: ${existingReason.title} → ${title.trim()}`,
        null,
        null
      )
    }

    res.json({
      success: true,
      data: updatedReason,
      message: 'แก้ไขเหตุผลสำเร็จ'
    })
  } catch (error) {
    console.error('❌ Update Remark Reason Controller Error:', error.message)
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการแก้ไขเหตุผล'
    })
  }
}

/**
 * Toggle สถานะ RemarkReason
 */
export const toggleRemarkReasonStatus = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user?.id

    // ตรวจสอบว่ามี RemarkReason อยู่หรือไม่
    const existingReason = await remarkReasonService.getRemarkReasonById(id)
    if (!existingReason) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบเหตุผลที่ระบุ'
      })
    }

    const updatedReason = await remarkReasonService.toggleRemarkReasonStatus(id)

    // บันทึก log
    if (userId) {
      const action = updatedReason.isActive ? 'ACTIVATE_REMARK_REASON' : 'DEACTIVATE_REMARK_REASON'
      const actionText = updatedReason.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'

      await createSystemLog(
        req,
        action,
        `${actionText}เหตุผล: ${existingReason.title}`,
        null,
        null
      )
    }

    res.json({
      success: true,
      data: updatedReason,
      message: `${updatedReason.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}เหตุผลเรียบร้อยแล้ว`
    })
  } catch (error) {
    console.error('❌ Toggle Remark Reason Status Controller Error:', error.message)
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะเหตุผล'
    })
  }
}

/**
 * ดึงรายการ RemarkReason ที่ใช้งานได้ (สำหรับ dropdown)
 */
export const getActiveRemarkReasons = async (req, res) => {
  try {
    const activeReasons = await remarkReasonService.getActiveRemarkReasons()
    res.json({
      success: true,
      data: activeReasons
    })
  } catch (error) {
    console.error('❌ Get Active Remark Reasons Controller Error:', error.message)
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลเหตุผล'
    })
  }
}



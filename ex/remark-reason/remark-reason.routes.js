import express from 'express'
import * as remarkReasonController from './remark-reason.controller.js'
import { authenticateToken, requirePermission } from '../middlewares/auth.middleware.js'
import { PERMISSIONS } from '../../constants/permissions.js'

const router = express.Router()

// ดึงรายการ RemarkReason ทั้งหมด
router.get('/', authenticateToken, requirePermission(PERMISSIONS.REMARK_REASON_READ), remarkReasonController.getRemarkReasons)

// ดึงรายการ RemarkReason ที่ใช้งานได้ (สำหรับ dropdown)
router.get('/active', authenticateToken, requirePermission(PERMISSIONS.REMARK_REASON_READ), remarkReasonController.getActiveRemarkReasons)

// เพิ่ม RemarkReason ใหม่
router.post('/', authenticateToken, requirePermission(PERMISSIONS.REMARK_REASON_CREATE), remarkReasonController.createRemarkReason)

// แก้ไข RemarkReason
router.put('/:id', authenticateToken, requirePermission(PERMISSIONS.REMARK_REASON_UPDATE), remarkReasonController.updateRemarkReason)

// Toggle สถานะ RemarkReason
router.patch('/:id/toggle', authenticateToken, requirePermission(PERMISSIONS.REMARK_REASON_UPDATE), remarkReasonController.toggleRemarkReasonStatus)

export default router


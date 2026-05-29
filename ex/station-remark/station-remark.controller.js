import * as stationRemarkService from './station-remark.service.js'
import { createSystemLog } from '../utils/logger.js'
import { emitScanDashboardUpdate } from '../socket/socket.service.js'

/**
 * สร้างหรืออัปเดต StationRemark
 * POST /api/v1/station-remarks
 */
export const upsertStationRemark = async (req, res) => {
  try {
    const { patientCNGroupId, patientMembershipId, stationId, reasonId, remark, cnGroupId } = req.body
    const userId = req.user?.id

    // ต้องมีอย่างน้อย 1 ตัว (patientCNGroupId หรือ patientMembershipId)
    if ((!patientCNGroupId && !patientMembershipId) || !stationId) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ patientCNGroupId หรือ patientMembershipId และ stationId'
      })
    }

    const stationRemark = await stationRemarkService.upsertStationRemark({
      patientCNGroupId: patientCNGroupId || null,
      patientMembershipId: patientMembershipId || null,
      stationId,
      reasonId: reasonId || null,
      remark: remark || null,
      createdBy: userId
    })

    // บันทึก log
    if (userId) {
      const logMessage = stationRemark.patientCNGroup
        ? `บันทึกหมายเหตุจุดตรวจ: ${stationRemark.station.name} สำหรับ CN: ${stationRemark.patientCNGroup.cn}`
        : `บันทึกหมายเหตุจุดตรวจ: ${stationRemark.station.name} สำหรับ Walk-in: ${stationRemark.patientMembership?.employeeCode || 'N/A'}`
      
      await createSystemLog(
        req,
        stationRemark.createdAt === stationRemark.updatedAt ? 'CREATE_STATION_REMARK' : 'UPDATE_STATION_REMARK',
        logMessage,
        null,
        null
      )
    }

    const resolvedCnGroupId = stationRemark.patientCNGroup?.cnGroupId || cnGroupId
    const io = req.app.get('io')
    if (io && resolvedCnGroupId) emitScanDashboardUpdate(io, resolvedCnGroupId)

    res.json({
      success: true,
      data: stationRemark,
      message: 'บันทึกหมายเหตุสำเร็จ'
    })
  } catch (error) {
    console.error('❌ Upsert Station Remark Controller Error:', error.message)
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาดในการบันทึกหมายเหตุ'
    })
  }
}

/**
 * ลบ StationRemark สำหรับกลุ่ม CNG
 * DELETE /api/v1/station-remarks/cng/:patientCNGroupId/station/:stationId
 */
export const deleteRemarkByCNG = async (req, res) => {
  try {
    const { patientCNGroupId, stationId } = req.params
    const { cnGroupId } = req.query
    const userId = req.user?.id

    const stationRemark = await stationRemarkService.deleteRemarkByCNG(
      patientCNGroupId,
      stationId
    )

    if (userId && stationRemark) {
      await createSystemLog(
        req,
        'DELETE_STATION_REMARK',
        `ลบหมายเหตุจุดตรวจ: ${stationRemark.station.name} สำหรับ CN: ${stationRemark.patientCNGroup?.cn}`,
        null,
        null
      )
    }

    const resolvedCnGroupId = stationRemark.patientCNGroup?.cnGroupId || cnGroupId
    const io = req.app.get('io')
    if (io && resolvedCnGroupId) emitScanDashboardUpdate(io, resolvedCnGroupId)

    res.json({ success: true, message: 'ลบหมายเหตุสำเร็จ' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * ลบ StationRemark สำหรับกลุ่ม Membership
 * DELETE /api/v1/station-remarks/membership/:patientMembershipId/station/:stationId
 */
export const deleteRemarkByMembership = async (req, res) => {
  try {
    const { patientMembershipId, stationId } = req.params
    const { cnGroupId } = req.query
    const userId = req.user?.id

    const stationRemark = await stationRemarkService.deleteRemarkByMembership(
      patientMembershipId,
      stationId
    )

    if (userId && stationRemark) {
      await createSystemLog(
        req,
        'DELETE_STATION_REMARK',
        `ลบหมายเหตุจุดตรวจ: ${stationRemark.station.name} สำหรับ EmployeeCode: ${stationRemark.patientMembership?.employeeCode || 'N/A'}`,
        null,
        null
      )
    }

    const io = req.app.get('io')
    if (io && cnGroupId) emitScanDashboardUpdate(io, cnGroupId)

    res.json({ success: true, message: 'ลบหมายเหตุสำเร็จ' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
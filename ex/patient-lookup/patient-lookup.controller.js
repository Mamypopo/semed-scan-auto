import { lookupPatientByCN } from './patient-lookup.service.js'

/**
 * ค้นหาผู้ป่วยจาก CN + stationId
 * GET /api/v1/patients/lookup?cn=xxx&stationId=1
 */
export const lookupPatient = async (req, res) => {
  try {
    const { cn, stationId } = req.query

    if (!cn || !stationId) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ cn และ stationId'
      })
    }

    const patient = await lookupPatientByCN(cn, stationId)

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบผู้ป่วยจาก CN นี้ในจุดตรวจที่เลือก'
      })
    }

    res.json({
      success: true,
      data: patient
    })
  } catch (error) {
    console.error('❌ Lookup Patient Error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'เกิดข้อผิดพลาด'
    })
  }
}

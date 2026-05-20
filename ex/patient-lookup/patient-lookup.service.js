import { prisma } from '../config/db.js'

/**
 * ค้นหาผู้ป่วยจาก CN และ stationId
 * CN อยู่ใน CNGroupMembership ไม่ใช่ PatientMembership
 */
export const lookupPatientByCN = async (cn, stationId) => {
  const sId = parseInt(stationId)

  const membership = await prisma.cNGroupMembership.findFirst({
    where: { cn: cn.trim() },
    select: {
      id: true,
      cn: true,
      employeeCode: true,
      companyName: true,
      department: true,
      patient: {
        select: {
          id: true,
          prefix: true,
          first_name: true,
          last_name: true,
          hn: true
        }
      }
    }
  })

  if (!membership) return null

  // เช็ค ExaminationItem ที่ medicalItem เชื่อมกับ station นี้
  const examItems = await prisma.patientExaminationItem.findMany({
    where: {
      patientCNGroupId: membership.id,
      status: 'ACTIVE',
      medicalItem: {
        stationToMedicalItems: {
          some: { stationId: sId }
        }
      }
    },
    select: {
      id: true,
      medicalItem: {
        select: { id: true, name: true, code: true }
      }
    }
  })

  // เช็ค remark เดิม
  const existingRemark = await prisma.stationRemark.findUnique({
    where: {
      patientCNGroupId_stationId: {
        patientCNGroupId: membership.id,
        stationId: sId
      }
    },
    select: {
      remark: true,
      reasonId: true,
      reason: { select: { id: true, title: true } }
    }
  })

  // ดึงชื่อ station
  const station = await prisma.station.findUnique({
    where: { id: sId },
    select: { id: true, name: true }
  })

  return {
    patientCNGroupId: membership.id,   // ← ใช้ตอน POST /station-remarks
    cn: membership.cn,
    employeeCode: membership.employeeCode,
    name: `${membership.patient?.prefix || ''} ${membership.patient?.first_name || ''} ${membership.patient?.last_name || ''}`.trim(),
    hn: membership.patient?.hn || null,
    companyName: membership.companyName,
    department: membership.department,
    station,
    hasExamAtStation: examItems.length > 0,
    examItems: examItems.map(e => ({
      id: e.id,
      name: e.medicalItem.name,
      code: e.medicalItem.code
    })),
    existingRemark: existingRemark
      ? {
          remark: existingRemark.remark,
          reasonId: existingRemark.reasonId,
          reasonTitle: existingRemark.reason?.title || null
        }
      : null
  }
}

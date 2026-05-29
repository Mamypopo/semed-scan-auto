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
      cnGroupId: true,
      cn: true,
      employeeCode: true,
      position: true,
      department: true,
      companyName: true,
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
        select: { id: true, name: true, nameEn: true, code: true }
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
    patientCNGroupId: membership.id,
    cnGroupId: membership.cnGroupId,
    cn: membership.cn,
    name: `${membership.patient?.prefix || ''} ${membership.patient?.first_name || ''} ${membership.patient?.last_name || ''}`.trim(),
    hn: membership.patient?.hn || null,
    employeeCode: membership.employeeCode || null,
    position: membership.position || null,
    department: membership.department || null,
    companyName: membership.companyName || null,
    station,
    hasExamAtStation: examItems.length > 0,
    examItems: examItems.map(e => ({
      id: e.id,
      name: e.medicalItem.name,
      nameEn: e.medicalItem.nameEn || null,
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

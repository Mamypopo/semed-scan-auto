import { prisma } from '../config/db.js'

/**
 * สร้างหรืออัปเดต StationRemark
 * @param {object} data - { patientCNGroupId?, patientMembershipId?, stationId, reasonId, remark, createdBy }
 * @returns {Promise<object>} StationRemark ที่สร้างหรืออัปเดต
 */
export const upsertStationRemark = async (data) => {
  try {
    const { patientCNGroupId, patientMembershipId, stationId, reasonId, remark, createdBy } = data

    // ต้องมีอย่างน้อย 1 ตัว (patientCNGroupId หรือ patientMembershipId)
    if ((!patientCNGroupId && !patientMembershipId) || !stationId) {
      throw new Error('กรุณาระบุ patientCNGroupId หรือ patientMembershipId และ stationId')
    }

    // หา existing remark ตามเงื่อนไข
    let existing = null
    if (patientCNGroupId) {
      existing = await prisma.stationRemark.findUnique({
        where: {
          patientCNGroupId_stationId: {
            patientCNGroupId,
            stationId
          }
        }
      })
    } else if (patientMembershipId) {
      existing = await prisma.stationRemark.findUnique({
        where: {
          patientMembershipId_stationId: {
            patientMembershipId,
            stationId
          }
        }
      })
    }

    if (existing) {
      // อัปเดต
      return await prisma.stationRemark.update({
        where: {
          id: existing.id
        },
        data: {
          reasonId: reasonId || null,
          remark: remark || null,
          updatedAt: new Date()
        },
        include: {
          reason: {
            select: {
              id: true,
              title: true
            }
          },
          patientCNGroup: {
            select: {
              id: true,
              cn: true,
              cnGroupId: true
            }
          },
          patientMembership: {
            select: {
              id: true,
              employeeCode: true
            }
          },
          station: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
    } else {
      // สร้างใหม่
      return await prisma.stationRemark.create({
        data: {
          patientCNGroupId: patientCNGroupId || null,
          patientMembershipId: patientMembershipId || null,
          stationId,
          reasonId: reasonId || null,
          remark: remark || null,
          createdBy: createdBy ? parseInt(createdBy) : null
        },
        include: {
          reason: {
            select: {
              id: true,
              title: true
            }
          },
          patientCNGroup: {
            select: {
              id: true,
              cn: true,
              cnGroupId: true
            }
          },
          patientMembership: {
            select: {
              id: true,
              employeeCode: true
            }
          },
          station: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
    }
  } catch (error) {
    console.error('❌ Upsert Station Remark Service Error:', error)
    throw error
  }
}

// stationRemarkService.js (Backend Service)

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

    const io = req.app.get('io')
    if (io && cnGroupId) emitScanDashboardUpdate(io, cnGroupId)

    res.json({ success: true, message: 'ลบหมายเหตุสำเร็จ' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
/**
 * ลบหมายเหตุสำหรับกลุ่ม Membership
 */
export const deleteRemarkByMembership = async (patientMembershipId, stationId) => {
  try {
    const sId = parseInt(stationId)
    if (isNaN(sId)) throw new Error('Station ID ต้องเป็นตัวเลข')

    // 1. ตรวจสอบว่ามีข้อมูลอยู่จริงหรือไม่
    const existing = await prisma.stationRemark.findUnique({
      where: {
        patientMembershipId_stationId: {
          patientMembershipId,
          stationId: sId
        }
      }
    })

    if (!existing) throw new Error('ไม่พบข้อมูลหมายเหตุที่ต้องการลบ')

    // 2. ดำเนินการลบ
    return await prisma.stationRemark.delete({
      where: { id: existing.id },
      include: {
        station: { select: { name: true } },
        patientMembership: { select: { employeeCode: true } }
      }
    })
  } catch (error) {
    console.error('❌ Delete Remark By Membership Service Error:', error)
    throw error
  }
}
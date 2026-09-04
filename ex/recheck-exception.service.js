import { prisma } from '../config/db.js'

/**
 * บันทึกเคสผิดปกติจากหน้า Recheck LAB — เรียกจาก recheckCheckpoint ทุกจุดที่ reject (ยกเว้น
 * บาร์โค้ดรูปแบบผิด ซึ่งยังไม่รู้แม้แต่ cn/stationId ให้บันทึก)
 *
 * กันซ้ำ: ถ้ามี exception ที่ยัง PENDING อยู่แล้วสำหรับ cnGroupId+cn+stationId+reason ชุดเดียวกัน
 * (เช่น มือลั่นยิงซ้ำ/ลองยิงหลายรอบ) จะไม่สร้างแถวใหม่ แค่ขยับ scannedAt/scannedBy ให้เป็นครั้งล่าสุด
 * แทน — กันไม่ให้ "รอตรวจสอบ" บวมด้วยรายการซ้ำของปัญหาเดียวกัน
 */
export const createRecheckException = async ({ cnGroupId, cn, stationId, barcode, reason, message, userId }) => {
  try {
    const existing = await prisma.recheckException.findFirst({
      where: { cnGroupId: cnGroupId || null, cn: cn || null, stationId: stationId ?? null, reason, status: 'PENDING' },
      select: { id: true },
    })

    if (existing) {
      await prisma.recheckException.update({
        where: { id: existing.id },
        data: {
          barcode,
          message: message || null,
          scannedAt: new Date(),
          scannedBy: userId ? Number(userId) : null,
        },
      })
      return
    }

    await prisma.recheckException.create({
      data: {
        cnGroupId: cnGroupId || null,
        cn: cn || null,
        stationId: stationId ?? null,
        barcode,
        reason,
        message: message || null,
        scannedBy: userId ? Number(userId) : null,
      },
    })
  } catch (error) {
    console.error('❌ createRecheckException error:', error)
  }
}

/**
 * ปิดเคสอัตโนมัติเมื่อ recheckCheckpoint สำเร็จจริง (confirm STATION→RECHECK ได้) — เกณฑ์ปิดเคส
 * ที่คนจะกด "แก้ไขแล้ว" เองอยู่แล้วคือ "เจอ ScanItem จริง recheck ผ่านแล้ว" ซึ่งพอดีตรงกับเงื่อนไขนี้
 * เป๊ะ เลยให้ระบบเช็คแทนคน ไม่ต้องรอให้กดปิดเองอีกที (ไม่ได้ผ่อนมาตรฐานอะไร แค่ตัดขั้นตอนซ้ำซ้อนออก)
 * เรียกแบบ fire-and-forget เหมือน createRecheckException — ไม่ block response หลัก
 */
export const autoResolveMatchingExceptions = async ({ cnGroupId, cn, stationId, userId }) => {
  try {
    const pending = await prisma.recheckException.findMany({
      where: { cnGroupId: cnGroupId || null, cn: cn || null, stationId: stationId ?? null, status: 'PENDING' },
      select: { id: true },
    })
    if (pending.length === 0) return

    await prisma.recheckException.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: {
        status: 'RESOLVED',
        resolutionNote: 'ปิดอัตโนมัติ — recheck สำเร็จภายหลัง',
        resolvedBy: userId ? Number(userId) : null,
        resolvedAt: new Date(),
      },
    })
  } catch (error) {
    console.error('❌ autoResolveMatchingExceptions error:', error)
  }
}

/**
 * รายการ RecheckException ของ CNGroup — ใช้ในการ์ด "รอตรวจสอบ" + modal ดูรายละเอียด
 */
export const getRecheckExceptions = async ({ cnGroupId, status = 'PENDING', page = 1, limit = 20 }) => {
  const where = {
    cnGroupId,
    ...(status && status !== 'all' ? { status } : {}),
  }

  const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit)
  const [items, total, pendingCount] = await Promise.all([
    prisma.recheckException.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { scannedAt: 'desc' },
      select: {
        id: true, cn: true, stationId: true, barcode: true, reason: true, message: true,
        scannedAt: true, status: true, resolvedAt: true, resolutionNote: true,
        station: { select: { id: true, name: true } },
        scannedByUser: { select: { id: true, name: true } },
        resolvedByUser: { select: { id: true, name: true } },
      },
    }),
    prisma.recheckException.count({ where }),
    prisma.recheckException.count({ where: { cnGroupId, status: 'PENDING' } }),
  ])

  return {
    success: true,
    data: items,
    pendingCount,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.max(1, Math.ceil(total / parseInt(limit))),
    },
  }
}

/**
 * ปิดเคส RecheckException — RESOLVED (สืบแล้วหาสาเหตุ/แก้ไขแล้ว) หรือ DISMISSED (ไม่ใช่ปัญหาจริง)
 */
export const resolveRecheckException = async ({ id, status, resolutionNote, userId }) => {
  if (!['RESOLVED', 'DISMISSED'].includes(status)) {
    return { success: false, message: 'status ต้องเป็น RESOLVED หรือ DISMISSED เท่านั้น' }
  }

  const existing = await prisma.recheckException.findUnique({ where: { id }, select: { id: true, status: true } })
  if (!existing) {
    return { success: false, message: 'ไม่พบรายการ' }
  }
  if (existing.status !== 'PENDING') {
    return { success: false, message: 'รายการนี้ถูกปิดไปแล้ว' }
  }

  const updated = await prisma.recheckException.update({
    where: { id },
    data: {
      status,
      resolutionNote: resolutionNote || null,
      resolvedBy: userId ? Number(userId) : null,
      resolvedAt: new Date(),
    },
  })

  return { success: true, data: updated }
}

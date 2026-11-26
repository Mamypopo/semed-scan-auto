// แปลง response ของ GET /scan/recheck/summary เป็นค่าที่หน้า Dashboard ใช้แสดง
//
// หน่วยหลักคือ "ตัวอย่าง" (ScanItem) ให้ตรงกับหน้าเว็บ Lab Recheck: ทั้งหมด = รอเช็ค + Lab รับแล้ว
// และเท่ากับผลรวมรายจุดตรวจ ส่วนจำนวนคนเป็นตัวเลขรอง (เดิมช่อง "ทั้งหมด" ใช้จำนวนคน ทำให้
// เห็น "ทั้งหมด 115 / รอเช็ค 116")
// ห้ามใช้ awaitingReceivePatients — HIS ตัดออกจาก summary แล้ว (ถ้าต้องการรายชื่อให้ใช้
// GET /scan/recheck/station-patients)

const num = (v) => (Number.isFinite(v) ? v : 0)

export function buildSummaryView(summary) {
  const s = summary || {}
  const awaiting = num(s.awaitingReceiveCount)
  const received = num(s.receivedCount)

  return {
    // API เก่าที่ยังไม่มี totalSamples: รวมจากหน่วยเดียวกัน ไม่ใช้จำนวนคน
    total: Number.isFinite(s.totalSamples) ? s.totalSamples : awaiting + received,
    awaiting,
    received,
    patients: Number.isFinite(s.totalPatients)
      ? { total: s.totalPatients, received: num(s.receivedPatientCount), awaiting: num(s.awaitingReceivePatientCount) }
      : null,
    awaitingRegistration: num(s.awaitingRegistrationCount),
    needsReview: num(s.needsReviewCount),
    stations: (s.stations || []).map((st) => {
      const needsReview = num(st.needsReview)
      const waiting = num(st.awaitingReceive)
      const total = num(st.total)
      const rawProgress = Number.isFinite(st.progress)
        ? st.progress
        : total > 0 ? Math.round((num(st.received) / total) * 100) : 0
      return {
        id: st.stationId,
        name: st.stationName || '',
        total,
        progress: Math.min(100, Math.max(0, rawProgress)),
        awaitingRegistration: num(st.awaitingRegistration),
        needsReview,
        // ค้างตรวจสอบสำคัญสุด (ต้องไปจัดการที่เว็บ) แสดงแดงแม้รับครบแล้ว
        tone: needsReview > 0 ? 'review' : waiting === 0 ? 'done' : 'waiting',
        label: `${waiting === 0 ? 'ครบ' : `รอ ${waiting}`} / ${num(st.total)}`
      }
    })
  }
}

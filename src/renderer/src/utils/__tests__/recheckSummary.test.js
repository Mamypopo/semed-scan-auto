import { describe, it, expect } from 'vitest'
import { buildSummaryView } from '../recheckSummary'

// ตัวอย่าง response จาก GET /scan/recheck/summary (ตัด awaitingReceivePatients ออกแล้วตาม HIS)
const api = {
  totalSamples: 116,
  awaitingReceiveCount: 116,
  receivedCount: 0,
  awaitingRegistrationCount: 2,
  needsReviewCount: 3,
  totalPatients: 115,
  awaitingReceivePatientCount: 115,
  receivedPatientCount: 0,
  stations: [
    { stationId: 7, stationName: 'CBC', total: 60, awaitingReceive: 0, received: 60, awaitingRegistration: 0, needsReview: 0, progress: 100 },
    { stationId: 5, stationName: 'Chem', total: 50, awaitingReceive: 10, received: 40, awaitingRegistration: 2, needsReview: 0, progress: 80 },
    { stationId: 9, stationName: 'UA', total: 6, awaitingReceive: 1, received: 5, awaitingRegistration: 0, needsReview: 3, progress: 83 }
  ]
}

describe('buildSummaryView — การ์ดบนสุด', () => {
  it('"ทั้งหมด" เป็นจำนวนตัวอย่าง (totalSamples) ไม่ใช่จำนวนคน', () => {
    const v = buildSummaryView(api)
    expect(v.total).toBe(116)
  })

  it('ทั้งหมด = รอเช็ค + Lab รับแล้ว (หน่วยเดียวกัน)', () => {
    const v = buildSummaryView({ ...api, totalSamples: 250, awaitingReceiveCount: 150, receivedCount: 100 })
    expect(v.total).toBe(v.awaiting + v.received)
  })

  it('API เก่าที่ยังไม่มี totalSamples — ใช้ รอเช็ค + รับแล้ว แทน (ไม่ใช้จำนวนคน)', () => {
    const { totalSamples, ...old } = api
    const v = buildSummaryView({ ...old, awaitingReceiveCount: 150, receivedCount: 100 })
    expect(v.total).toBe(250)
  })

  it('จำนวนคนเป็นตัวเลขรอง', () => {
    const v = buildSummaryView({ ...api, totalPatients: 100, receivedPatientCount: 40, awaitingReceivePatientCount: 60 })
    expect(v.patients).toEqual({ total: 100, received: 40, awaiting: 60 })
  })

  it('API ไม่ส่งจำนวนคนมา — ไม่แสดงบรรทัดจำนวนคน', () => {
    const v = buildSummaryView({ totalSamples: 3, awaitingReceiveCount: 3, receivedCount: 0, stations: [] })
    expect(v.patients).toBeNull()
  })

  it('ส่งต่อ needsReview และ awaitingRegistration (ไม่มี = 0)', () => {
    expect(buildSummaryView(api).needsReview).toBe(3)
    expect(buildSummaryView(api).awaitingRegistration).toBe(2)
    const v = buildSummaryView({ totalSamples: 0, awaitingReceiveCount: 0, receivedCount: 0, stations: [] })
    expect(v.needsReview).toBe(0)
    expect(v.awaitingRegistration).toBe(0)
  })

  it('summary ว่าง/undefined ไม่พัง', () => {
    const v = buildSummaryView(undefined)
    expect(v.total).toBe(0)
    expect(v.stations).toEqual([])
  })
})

describe('buildSummaryView — รายจุดตรวจ', () => {
  const byName = (v, name) => v.stations.find((s) => s.name === name)

  it('รับครบ → "ครบ" สีเขียว', () => {
    const st = byName(buildSummaryView(api), 'CBC')
    expect(st.tone).toBe('done')
    expect(st.label).toBe('ครบ / 60')
  })

  it('ยังรออยู่ → "รอ N / total" สีเหลือง และบอกจำนวนที่รอทะเบียน', () => {
    const st = byName(buildSummaryView(api), 'Chem')
    expect(st.tone).toBe('waiting')
    expect(st.label).toBe('รอ 10 / 50')
    expect(st.awaitingRegistration).toBe(2)
  })

  it('มีค้างตรวจสอบ → สีแดงมาก่อนสถานะอื่น พร้อมจำนวน', () => {
    const st = byName(buildSummaryView(api), 'UA')
    expect(st.tone).toBe('review')
    expect(st.needsReview).toBe(3)
  })

  it('ค้างตรวจสอบแม้รับครบแล้ว ก็ยังเป็นสีแดง', () => {
    const v = buildSummaryView({ ...api, stations: [{ stationId: 1, stationName: 'X', total: 5, awaitingReceive: 0, received: 5, needsReview: 1 }] })
    expect(v.stations[0].tone).toBe('review')
  })

  it('ความคืบหน้ารายจุด = รับแล้ว / ทั้งหมด เป็น %', () => {
    const v = buildSummaryView(api)
    expect(byName(v, 'CBC').progress).toBe(100)
    expect(byName(v, 'Chem').progress).toBe(80)
  })

  it('API ไม่ส่ง progress มา — คำนวณจาก received/total เอง, total 0 ไม่หารศูนย์', () => {
    const v = buildSummaryView({ stations: [
      { stationId: 1, stationName: 'A', total: 4, awaitingReceive: 3, received: 1 },
      { stationId: 2, stationName: 'B', total: 0, awaitingReceive: 0, received: 0 }
    ] })
    expect(v.stations[0].progress).toBe(25)
    expect(v.stations[1].progress).toBe(0)
  })

  it('progress อยู่ในช่วง 0–100 เสมอ', () => {
    const v = buildSummaryView({ stations: [{ stationId: 1, stationName: 'A', total: 2, awaitingReceive: 0, received: 5, progress: 250 }] })
    expect(v.stations[0].progress).toBe(100)
  })

  it('คงลำดับจุดตรวจตามที่ API ส่งมา', () => {
    expect(buildSummaryView(api).stations.map((s) => s.id)).toEqual([7, 5, 9])
  })
})

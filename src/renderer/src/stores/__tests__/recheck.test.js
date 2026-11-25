import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { reactive } from 'vue'

// auth store จริง import sweetalert2 (ต้องมี DOM) — ใช้ตัวปลอมที่มีแค่ selectedCNGroup
const fakeAuth = reactive({ selectedCNGroup: null })
vi.mock('../auth', () => ({ useAuthStore: () => fakeAuth }))

const { useRecheckStore } = await import('../recheck')

// ---------- test helpers ----------

function deferred() {
  let resolve
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}

function okSummary(n) {
  return { success: true, data: { totalPatients: n, awaitingReceiveCount: 0, receivedCount: n, stations: [] } }
}

let handlers
let summaryCalls // [{ cnGroupId, d: deferred }]

function setupFakeElectron() {
  handlers = {}
  summaryCalls = []
  globalThis.window = {
    api: {
      onRecheckResult: (cb) => { (handlers.result ||= []).push(cb) },
      onRecheckError: (cb) => { (handlers.error ||= []).push(cb) },
      getRecheckSummary: vi.fn((cnGroupId) => {
        const d = deferred()
        summaryCalls.push({ cnGroupId, d })
        return d.promise
      }),
      cancelRecheck: vi.fn(async () => ({ success: true }))
    }
  }
  const doc = new EventTarget()
  doc.hidden = false
  globalThis.document = doc
}

function setHidden(hidden) {
  document.hidden = hidden
  document.dispatchEvent(new Event('visibilitychange'))
}

/** จำลอง main process ส่ง 'recheck:result' มา (เหมือนยิงบาร์โค้ด 1 ครั้ง) */
function emitRecheck({ isNew = true } = {}) {
  for (const cb of handlers.result || []) {
    cb({ isNewRecheck: isNew, barcode: 'CN001.5', patientName: 'Test', data: {}, timestamp: new Date().toISOString() })
  }
}

/** ให้ summary ที่ค้างอยู่ตัวที่ i ตอบกลับ แล้วรอ microtask ให้ store ทำงานต่อ */
async function finishSummary(i, value = okSummary(1)) {
  summaryCalls[i].d.resolve(value)
  await vi.advanceTimersByTimeAsync(0)
}

let store

beforeEach(() => {
  vi.useFakeTimers()
  setupFakeElectron()
  fakeAuth.selectedCNGroup = { id: 'G1', name: 'Group 1' }
  setActivePinia(createPinia())
  store = useRecheckStore()
  store.setupIPCListeners()
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------- debounce หลังยิง ----------

describe('summary หลังยิง recheck', () => {
  it('ไม่ดึง summary ทันทีหลังยิงสำเร็จ', () => {
    emitRecheck()
    expect(window.api.getRecheckSummary).not.toHaveBeenCalled()
  })

  it('ดึงครั้งเดียวหลังหยุดยิง 5 วินาที', async () => {
    emitRecheck()
    await vi.advanceTimersByTimeAsync(4999)
    expect(window.api.getRecheckSummary).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(window.api.getRecheckSummary).toHaveBeenCalledTimes(1)
    expect(window.api.getRecheckSummary).toHaveBeenCalledWith('G1')
  })

  it('ยิงต่อเนื่อง (ห่างกัน < 5 วิ) เลื่อนการดึงออกไปเรื่อยๆ', async () => {
    emitRecheck()
    await vi.advanceTimersByTimeAsync(3000)
    emitRecheck()
    await vi.advanceTimersByTimeAsync(3000)
    emitRecheck()
    await vi.advanceTimersByTimeAsync(4999)
    expect(window.api.getRecheckSummary).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(window.api.getRecheckSummary).toHaveBeenCalledTimes(1)
  })

  it('ยิงยาวไม่หยุด ดึงไม่ถี่กว่าทุก 30 วินาที (แต่ยังได้ดึงระหว่างยิง)', async () => {
    // ยิงทุก 2 วิ ต่อเนื่อง 61 วิ
    for (let t = 0; t <= 60000; t += 2000) {
      emitRecheck()
      await vi.advanceTimersByTimeAsync(2000)
      // ให้ตัวที่ค้างตอบกลับทันที จะได้ไม่ติดกฎไม่ดึงซ้อน
      for (let i = 0; i < summaryCalls.length; i++) summaryCalls[i].d.resolve(okSummary(i))
    }
    const n = window.api.getRecheckSummary.mock.calls.length
    expect(n).toBeGreaterThanOrEqual(2) // ยอดขยับระหว่างยิง
    expect(n).toBeLessThanOrEqual(3) // ~62 วิ / 30 วิ
  })

  it('ยิงซ้ำ (isNewRecheck: false) ไม่ทำให้ดึง summary', async () => {
    emitRecheck({ isNew: false })
    await vi.advanceTimersByTimeAsync(60000)
    expect(window.api.getRecheckSummary).not.toHaveBeenCalled()
  })

  it('ไม่มี CNGroup ที่เลือก ไม่ดึง', async () => {
    fakeAuth.selectedCNGroup = null
    emitRecheck()
    await vi.advanceTimersByTimeAsync(60000)
    expect(window.api.getRecheckSummary).not.toHaveBeenCalled()
  })
})

// ---------- ไม่ดึงซ้อน ----------

describe('ไม่ดึงซ้อน', () => {
  it('มีตัวค้างอยู่ กดรีเฟรชซ้ำไม่เริ่มตัวใหม่', () => {
    store.refreshSummaryNow()
    store.refreshSummaryNow()
    store.refreshSummaryNow()
    expect(window.api.getRecheckSummary).toHaveBeenCalledTimes(1)
  })

  it('ถ้ามีคำขอระหว่างค้าง จะดึงตามอีกแค่ 1 รอบหลังตัวเดิมเสร็จ', async () => {
    store.refreshSummaryNow()
    store.refreshSummaryNow()
    store.refreshSummaryNow()
    await finishSummary(0)
    expect(window.api.getRecheckSummary).toHaveBeenCalledTimes(2)
    await finishSummary(1)
    expect(window.api.getRecheckSummary).toHaveBeenCalledTimes(2)
  })

  it('ไม่มีคำขอระหว่างค้าง ก็ไม่ดึงตาม', async () => {
    store.refreshSummaryNow()
    await finishSummary(0)
    expect(window.api.getRecheckSummary).toHaveBeenCalledTimes(1)
  })

  it('summary ล้มเหลว ไม่ค้างสถานะ loading และดึงใหม่ได้', async () => {
    store.refreshSummaryNow()
    summaryCalls[0].d.resolve({ success: false, message: 'timeout of 10000ms exceeded' })
    await vi.advanceTimersByTimeAsync(0)
    expect(store.isLoadingSummary).toBe(false)
    store.refreshSummaryNow()
    expect(window.api.getRecheckSummary).toHaveBeenCalledTimes(2)
  })
})

// ---------- หน้าต่างซ่อน ----------

describe('หน้าต่างย่อ/ซ่อน', () => {
  it('ซ่อนอยู่ไม่ดึง แล้วดึงครั้งเดียวตอนกลับมา', async () => {
    setHidden(true)
    emitRecheck()
    await vi.advanceTimersByTimeAsync(60000)
    emitRecheck()
    await vi.advanceTimersByTimeAsync(60000)
    expect(window.api.getRecheckSummary).not.toHaveBeenCalled()

    setHidden(false)
    expect(window.api.getRecheckSummary).toHaveBeenCalledTimes(1)
  })

  it('ซ่อนแล้วกลับมาโดยไม่มีอะไรค้าง ไม่ดึงเปล่าๆ', () => {
    setHidden(true)
    setHidden(false)
    expect(window.api.getRecheckSummary).not.toHaveBeenCalled()
  })
})

// ---------- ผลลัพธ์ และการเปลี่ยน CNGroup ----------

describe('ผลลัพธ์ summary', () => {
  it('ได้ผลแล้วอัปเดตตัวเลขและ hasLoadedSummary', async () => {
    store.refreshSummaryNow()
    expect(store.isLoadingSummary).toBe(true)
    await finishSummary(0, okSummary(42))
    expect(store.summary.totalPatients).toBe(42)
    expect(store.hasLoadedSummary).toBe(true)
    expect(store.isLoadingSummary).toBe(false)
  })

  it('เปลี่ยน CNGroup ระหว่างรอ — ทิ้งผลของกลุ่มเดิม แล้วโหลดกลุ่มใหม่', async () => {
    store.loadSummary('G1')
    // ผู้ใช้เปลี่ยนกลุ่ม (เหมือน watch ใน DashboardView)
    fakeAuth.selectedCNGroup = { id: 'G2', name: 'Group 2' }
    store.resetSummary()
    store.loadSummary('G2')

    await finishSummary(0, okSummary(111)) // ผลของ G1 มาช้า
    expect(store.summary.totalPatients).toBe(0)
    expect(summaryCalls[1].cnGroupId).toBe('G2')

    await finishSummary(1, okSummary(222))
    expect(store.summary.totalPatients).toBe(222)
  })

  it('resetSummary ยกเลิก debounce ที่รออยู่', async () => {
    emitRecheck()
    store.resetSummary()
    await vi.advanceTimersByTimeAsync(60000)
    expect(window.api.getRecheckSummary).not.toHaveBeenCalled()
  })

  it('ยกเลิก recheck แล้วดึง summary แบบ debounce (ไม่ทันที)', async () => {
    const entry = { scanItemId: 9, status: 'ok' }
    await store.cancelRecheckEntry(entry)
    expect(entry.status).toBe('cancelled')
    expect(window.api.getRecheckSummary).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(5000)
    expect(window.api.getRecheckSummary).toHaveBeenCalledTimes(1)
  })
})

// ---------- listener ----------

describe('IPC listeners', () => {
  it('setupIPCListeners เรียกซ้ำ (Dashboard mount ใหม่) ไม่ลงทะเบียนซ้อน', () => {
    store.setupIPCListeners()
    store.setupIPCListeners()
    emitRecheck()
    expect(store.history).toHaveLength(1)
  })
})

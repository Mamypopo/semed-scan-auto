import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'

export const useRecheckStore = defineStore('recheck', () => {
  const authStore = useAuthStore()
  const history = ref([])
  const isScanning = ref(false)

  const summary = ref({ totalPatients: 0, awaitingReceiveCount: 0, receivedCount: 0, stations: [] })
  const isLoadingSummary = ref(false)

  // โหลดสำเร็จของ CNGroup ปัจจุบันแล้วอย่างน้อย 1 ครั้ง — ใช้ซ่อน skeleton ตอนรีเฟรชเบื้องหลัง
  const hasLoadedSummary = ref(false)

  const recentHistory = computed(() => history.value.slice(0, 20))

  function clearHistory() {
    history.value = []
  }

  // ==========================================
  // Summary refresh — ลดภาระ GET /scan/recheck/summary
  //   - หลังยิง: debounce 5 วิหลังหยุดยิง (ยิงต่อเนื่องเลื่อนออกไปเรื่อยๆ)
  //   - ยิงยาวๆ: ดึงไม่ถี่กว่าทุก 30 วิ (max wait)
  //   - ไม่ดึงซ้อน: มีตัวค้างอยู่ ไม่เริ่มตัวใหม่ (จดไว้ แล้วตามทีหลังครั้งเดียว)
  //   - หน้าต่างย่อ/ซ่อน: ไม่ดึง ดึงครั้งเดียวตอนกลับมา
  // ==========================================
  const SUMMARY_DEBOUNCE_MS = 5000
  const SUMMARY_MAX_WAIT_MS = 30000

  let summaryTimer = null
  let firstPendingAt = 0       // เวลาที่มีการยิงสำเร็จครั้งแรกที่ยังไม่ได้รีเฟรช
  let inFlightCnGroupId = null // CNGroup ที่กำลังโหลดอยู่ (null = ไม่มีตัวค้าง)
  let queuedCnGroupId = null   // ต้องโหลดใหม่หลังตัวที่ค้างอยู่เสร็จ
  let refreshWhenVisible = false

  function clearSummaryTimer() {
    if (summaryTimer) clearTimeout(summaryTimer)
    summaryTimer = null
    firstPendingAt = 0
  }

  async function loadSummary(cnGroupId) {
    if (!cnGroupId) return

    // หน้าต่างซ่อนอยู่ → เลื่อนไปดึงตอนกลับมา
    if (document.hidden) {
      refreshWhenVisible = true
      return
    }
    // มีตัวค้างอยู่ → ไม่ยิงซ้อน จดไว้ว่าต้องดึงอีกรอบ
    if (inFlightCnGroupId) {
      queuedCnGroupId = cnGroupId
      return
    }

    clearSummaryTimer()
    inFlightCnGroupId = cnGroupId
    isLoadingSummary.value = true
    try {
      const result = await window.api.getRecheckSummary(cnGroupId)
      // ทิ้งผลถ้าผู้ใช้เปลี่ยน CNGroup ไประหว่างรอ
      if (result.success && authStore.selectedCNGroup?.id === cnGroupId) {
        summary.value = result.data
        hasLoadedSummary.value = true
      }
    } catch (e) {
      console.error('Failed to load recheck summary:', e)
    } finally {
      isLoadingSummary.value = false
      inFlightCnGroupId = null
      const next = queuedCnGroupId
      queuedCnGroupId = null
      // ตามด้วยรอบเดียว เฉพาะถ้ายังเป็น CNGroup ที่เลือกอยู่
      if (next && next === authStore.selectedCNGroup?.id) loadSummary(next)
    }
  }

  /** เรียกหลังยิงสำเร็จ — debounce + max wait แทนการดึงทันที */
  function scheduleSummaryRefresh() {
    const cnGroupId = authStore.selectedCNGroup?.id
    if (!cnGroupId) return

    const now = Date.now()
    if (!firstPendingAt) firstPendingAt = now
    if (summaryTimer) clearTimeout(summaryTimer)

    const untilMaxWait = firstPendingAt + SUMMARY_MAX_WAIT_MS - now
    const delay = Math.max(0, Math.min(SUMMARY_DEBOUNCE_MS, untilMaxWait))
    summaryTimer = setTimeout(() => {
      summaryTimer = null
      firstPendingAt = 0
      loadSummary(authStore.selectedCNGroup?.id)
    }, delay)
  }

  /** ปุ่มรีเฟรช — ดึงทันที (ยังเคารพกฎไม่ดึงซ้อน) */
  function refreshSummaryNow() {
    loadSummary(authStore.selectedCNGroup?.id)
  }

  function onVisibilityChange() {
    if (!document.hidden && refreshWhenVisible) {
      refreshWhenVisible = false
      loadSummary(authStore.selectedCNGroup?.id)
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  function resetSummary() {
    clearSummaryTimer()
    queuedCnGroupId = null
    refreshWhenVisible = false
    hasLoadedSummary.value = false
    summary.value = { totalPatients: 0, awaitingReceiveCount: 0, receivedCount: 0, stations: [] }
  }

  async function cancelRecheckEntry(entry) {
    if (!entry.scanItemId) return
    try {
      const result = await window.api.cancelRecheck(entry.scanItemId)
      if (result.success) {
        entry.status = 'cancelled'
        scheduleSummaryRefresh()
      }
      return result
    } catch (e) {
      return { success: false, message: e.message }
    }
  }

  // preload ใช้ ipcRenderer.on (ไม่มี cleanup) — Dashboard mount ซ้ำจะทำให้ listener ซ้อน
  // (ประวัติขึ้นซ้ำ) จึงลงทะเบียนครั้งเดียวต่ออายุ store
  let listenersReady = false

  function setupIPCListeners() {
    if (listenersReady) return
    listenersReady = true

    window.api.onRecheckResult((data) => {
      isScanning.value = false
      const time = new Date(data.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      history.value.unshift({
        status: data.isNewRecheck ? 'ok' : 'duplicate',
        barcode: data.barcode,
        name: data.patientName,
        station: data.data?.station?.name,
        scanItemId: data.data?.scanItemId || null,
        message: data.data?.message,
        time
      })
      if (history.value.length > 20) history.value = history.value.slice(0, 20)

      // รีเฟรช summary จาก server (ไม่ patch ตัวเลขในเครื่อง) — แบบ debounce ไม่ดึงทุกครั้งที่ยิง
      if (data.isNewRecheck) scheduleSummaryRefresh()
    })

    window.api.onRecheckError((data) => {
      isScanning.value = false
      const time = new Date(data.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      history.value.unshift({ status: 'error', message: data.error, time })
      if (history.value.length > 20) history.value = history.value.slice(0, 20)
    })
  }

  return {
    history,
    recentHistory,
    isScanning,
    summary,
    isLoadingSummary,
    hasLoadedSummary,
    clearHistory,
    loadSummary,
    refreshSummaryNow,
    resetSummary,
    cancelRecheckEntry,
    setupIPCListeners
  }
})

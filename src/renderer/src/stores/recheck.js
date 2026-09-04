import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'

export const useRecheckStore = defineStore('recheck', () => {
  const authStore = useAuthStore()
  const history = ref([])
  const isScanning = ref(false)
  const pendingNotFound = ref(null) // { barcode, cnGroupId, patient, station, timestamp }
  const isConfirmingLabCreate = ref(false)

  const summary = ref({ totalPatients: 0, awaitingReceiveCount: 0, receivedCount: 0, stations: [] })
  const isLoadingSummary = ref(false)

  const recentHistory = computed(() => history.value.slice(0, 20))

  function patientName(p) {
    if (!p) return null
    return `${p.prefix || ''} ${p.first_name || ''} ${p.last_name || ''}`.trim()
  }

  function clearHistory() {
    history.value = []
  }

  async function loadSummary(cnGroupId) {
    if (!cnGroupId) return
    isLoadingSummary.value = true
    try {
      const result = await window.api.getRecheckSummary(cnGroupId)
      if (result.success) {
        summary.value = result.data
      }
    } catch (e) {
      console.error('Failed to load recheck summary:', e)
    } finally {
      isLoadingSummary.value = false
    }
  }

  function resetSummary() {
    summary.value = { totalPatients: 0, awaitingReceiveCount: 0, receivedCount: 0, stations: [] }
  }

  async function confirmLabCreate() {
    if (!pendingNotFound.value || isConfirmingLabCreate.value) return
    const { barcode, cnGroupId, patient, station } = pendingNotFound.value
    isConfirmingLabCreate.value = true
    pendingNotFound.value = null
    try {
      await window.api.recheckLabCreate(barcode, cnGroupId)
      // ผล success/error จะเข้ามาทาง onRecheckResult/onRecheckError ที่ setupIPCListeners ดักไว้อยู่แล้ว
    } catch (e) {
      history.value.unshift({
        status: 'error',
        barcode,
        name: patientName(patient),
        station: station?.name,
        message: e.message,
        time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      })
    } finally {
      isConfirmingLabCreate.value = false
    }
  }

  function cancelPendingNotFound() {
    pendingNotFound.value = null
  }

  async function cancelRecheckEntry(entry) {
    if (!entry.scanItemId) return
    try {
      const result = await window.api.cancelRecheck(entry.scanItemId)
      if (result.success) {
        entry.status = 'cancelled'
        if (authStore.selectedCNGroup?.id) loadSummary(authStore.selectedCNGroup.id)
      }
      return result
    } catch (e) {
      return { success: false, message: e.message }
    }
  }

  function setupIPCListeners() {
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

      // รีเฟรช summary จาก server แทนการ patch ตัวเลขในเครื่อง กันตัวเลขเพี้ยนจากของจริง
      if (data.isNewRecheck && authStore.selectedCNGroup?.id) {
        loadSummary(authStore.selectedCNGroup.id)
      }
    })

    window.api.onRecheckError((data) => {
      isScanning.value = false
      const time = new Date(data.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      history.value.unshift({ status: 'error', message: data.error, time })
      if (history.value.length > 20) history.value = history.value.slice(0, 20)
    })

    window.api.onRecheckNotFound((data) => {
      isScanning.value = false
      pendingNotFound.value = data
    })
  }

  return {
    history,
    recentHistory,
    isScanning,
    pendingNotFound,
    isConfirmingLabCreate,
    summary,
    isLoadingSummary,
    clearHistory,
    loadSummary,
    resetSummary,
    confirmLabCreate,
    cancelPendingNotFound,
    cancelRecheckEntry,
    setupIPCListeners
  }
})

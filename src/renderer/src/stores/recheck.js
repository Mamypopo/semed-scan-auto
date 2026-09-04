import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'

export const useRecheckStore = defineStore('recheck', () => {
  const authStore = useAuthStore()
  const history = ref([])
  const isScanning = ref(false)

  const summary = ref({ totalPatients: 0, awaitingReceiveCount: 0, receivedCount: 0, stations: [] })
  const isLoadingSummary = ref(false)

  const recentHistory = computed(() => history.value.slice(0, 20))

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
  }

  return {
    history,
    recentHistory,
    isScanning,
    summary,
    isLoadingSummary,
    clearHistory,
    loadSummary,
    resetSummary,
    cancelRecheckEntry,
    setupIPCListeners
  }
})

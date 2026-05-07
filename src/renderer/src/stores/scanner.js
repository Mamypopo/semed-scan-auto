import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Swal from 'sweetalert2'

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 4000,
  timerProgressBar: true,
  customClass: {
    popup: 'swal-app'
  }
})

export const useScannerStore = defineStore('scanner', () => {
  const scanHistory = ref([])
  const isScanning = ref(false)
  const lastScan = ref(null)

  const recentScans = computed(() => scanHistory.value.slice(0, 5))

  function clearHistory() {
    scanHistory.value = []
    lastScan.value = null
  }

  function setupIPCListeners() {
    window.api.onScanSuccess((data) => {
      isScanning.value = false
      const p = data?.data?.patient
      const resolvedName = p
        ? `${p.prefix || ''} ${p.first_name || ''} ${p.last_name || ''}`.trim()
        : data.patientName || 'ไม่ทราบชื่อ'
      const scanResult = {
        success: true,
        patientName: resolvedName,
        data: data.data,
        timestamp: data.timestamp
      }
      scanHistory.value.unshift(scanResult)
      if (scanHistory.value.length > 20) scanHistory.value = scanHistory.value.slice(0, 20)
      lastScan.value = scanResult

      Toast.fire({
        icon: 'success',
        title: `สแกนสำเร็จ: ${scanResult.patientName}`
      })
    })

    window.api.onScanError((data) => {
      isScanning.value = false
      const errorResult = {
        success: false,
        error: data.error,
        status: data.status,
        timestamp: data.timestamp
      }
      scanHistory.value.unshift(errorResult)
      if (scanHistory.value.length > 20) scanHistory.value = scanHistory.value.slice(0, 20)
      lastScan.value = errorResult

      Toast.fire({
        icon: 'error',
        title: data.error
      })
    })
  }

  return {
    scanHistory,
    isScanning,
    lastScan,
    recentScans,
    clearHistory,
    setupIPCListeners
  }
})

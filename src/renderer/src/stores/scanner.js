import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Swal from 'sweetalert2'
import { useAuthStore } from './auth'

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 4000,
  timerProgressBar: true,
  customClass: {
    popup: 'swal-pearl'
  }
})

export const useScannerStore = defineStore('scanner', () => {
  const authStore = useAuthStore()
  
  // State
  const scanHistory = ref([])
  const isScanning = ref(false)
  const lastScan = ref(null)
  const scanMode = ref('checkup') // 'checkup' | 'clinic'
  
  // Getters
  const recentScans = computed(() => scanHistory.value.slice(0, 5))
  
  // Actions
  function setScanMode(mode) {
    scanMode.value = mode
    window.api.saveConfig({ scanMode: mode }).catch(console.error)
  }
  
  async function loadScanMode() {
    const config = await window.api.getConfig()
    if (config.scanMode) {
      scanMode.value = config.scanMode
    }
  }
  
  async function handleScan(barcode) {
    if (!authStore.selectedStation) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่พบจุดตรวจ',
        text: 'กรุณาเลือกจุดตรวจก่อนสแกน',
        customClass: { popup: 'swal-pearl' }
      })
      return
    }
    
    isScanning.value = true
    
    try {
      // TODO: Call API based on scan mode
      // For now, simulate successful scan
      const scanResult = {
        success: true,
        patientName: 'คนไข้ทดสอบ',
        barcode: barcode,
        timestamp: new Date().toISOString(),
        station: authStore.selectedStation.name
      }
      
      // Add to history
      scanHistory.value.unshift(scanResult)
      if (scanHistory.value.length > 20) {
        scanHistory.value = scanHistory.value.slice(0, 20)
      }
      
      lastScan.value = scanResult
      
      Toast.fire({
        icon: 'success',
        title: `สแกนสำเร็จ: ${scanResult.patientName}`
      })
      
    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message,
        barcode: barcode,
        timestamp: new Date().toISOString()
      }
      
      scanHistory.value.unshift(errorResult)
      lastScan.value = errorResult
      
      Swal.fire({
        icon: 'error',
        title: 'สแกนไม่สำเร็จ',
        text: error.message,
        customClass: { popup: 'swal-pearl' }
      })
    } finally {
      isScanning.value = false
    }
  }
  
  function clearHistory() {
    scanHistory.value = []
    lastScan.value = null
  }
  
  // Setup IPC listeners
  function setupIPCListeners() {
    window.api.onScanSuccess((data) => {
      const scanResult = {
        success: true,
        patientName: data.patientName || 'ไม่ทราบชื่อ',
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
      const errorResult = {
        success: false,
        error: data.error,
        status: data.status,
        timestamp: data.timestamp
      }
      scanHistory.value.unshift(errorResult)
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
    scanMode,
    recentScans,
    setScanMode,
    loadScanMode,
    handleScan,
    clearHistory,
    setupIPCListeners
  }
})

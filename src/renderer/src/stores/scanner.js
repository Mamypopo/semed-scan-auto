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
  const cancellingId = ref(null)
  const cancelMode = ref(false)

  const recentScans = computed(() => scanHistory.value.slice(0, 20))

  async function cancelScan(scan) {
    if (!scan?.scanId || scan?.cancelled) return
    cancellingId.value = scan.scanId
    try {
      const result = await window.api.cancelScan(scan.scanId)
      if (result.success) {
        const idx = scanHistory.value.findIndex(s => s.scanId === scan.scanId)
        if (idx !== -1) scanHistory.value[idx] = { ...scanHistory.value[idx], cancelled: true }
        if (lastScan.value?.scanId === scan.scanId) {
          lastScan.value = { ...lastScan.value, cancelled: true }
        }
        Toast.fire({ icon: 'success', title: result.data?.message || 'ยกเลิกการสแกนสำเร็จ' })
      } else {
        Toast.fire({ icon: 'error', title: result.data?.message || result.message || 'ยกเลิกไม่สำเร็จ' })
      }
    } catch (e) {
      Toast.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด' })
    } finally {
      cancellingId.value = null
    }
  }

  async function toggleCancelMode() {
    cancelMode.value = !cancelMode.value
    await window.api.setCancelMode(cancelMode.value)
  }

  async function handleCancelLookup({ cn }) {
    const found = scanHistory.value.find(
      s => s.success && !s.cancelled && s.data?.membership?.cn === cn
    )
    if (!found) {
      Toast.fire({ icon: 'warning', title: `ไม่พบการสแกน: ${cn}` })
      return
    }
    const ts = found.timestamp
      ? new Date(found.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : ''
    const result = await Swal.fire({
      title: 'ยืนยันการยกเลิก',
      html: `ผู้ป่วย: <b>${found.patientName}</b><br><span style="font-size:0.8em;color:#71717a">เวลา: ${ts}</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยกเลิกการสแกน',
      cancelButtonText: 'ปิด',
      confirmButtonColor: '#ef4444',
      customClass: { popup: 'swal-app' }
    })
    if (result.isConfirmed) {
      await cancelScan(found)
    }
  }

  function clearHistory() {
    scanHistory.value = []
    lastScan.value = null
  }

  function setupIPCListeners() {
    window.api.onCancelLookup((data) => {
      handleCancelLookup(data)
    })

    window.api.onScanSuccess((data) => {
      isScanning.value = false
      const p = data?.data?.patient
      const resolvedName = p
        ? `${p.prefix || ''} ${p.first_name || ''} ${p.last_name || ''}`.trim()
        : data.patientName || 'ไม่ทราบชื่อ'
      const backendMsg = data.data?.message ?? null
      const isNewScan = data.data?.isNewScan !== false
      const scanResult = {
        success: true,
        patientName: resolvedName,
        data: data.data,
        scanId: data.data?.scanItem?.id ?? null,
        timestamp: data.timestamp,
        cancelled: false,
        message: backendMsg,
        isNewScan
      }
      scanHistory.value.unshift(scanResult)
      if (scanHistory.value.length > 20) scanHistory.value = scanHistory.value.slice(0, 20)
      lastScan.value = scanResult

      Toast.fire({
        icon: isNewScan ? 'success' : 'warning',
        title: backendMsg || `สแกนสำเร็จ: ${scanResult.patientName}`
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
    cancellingId,
    cancelMode,
    recentScans,
    cancelScan,
    toggleCancelMode,
    clearHistory,
    setupIPCListeners
  }
})

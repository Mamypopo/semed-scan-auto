import { onMounted, onUnmounted } from 'vue'

const SCAN_THRESHOLD_MS = 50
const MIN_BARCODE_LENGTH = 5

export function useScanner() {
  let buffer = ''
  let lastKeyTime = 0

  function onKeyDown(e) {
    const now = Date.now()
    const gap = now - lastKeyTime

    // ถ้าห่างเกิน threshold → ล้าง buffer (คนพิมพ์ปกติ)
    if (gap > SCAN_THRESHOLD_MS && buffer.length > 0) {
      buffer = ''
    }

    lastKeyTime = now

    if (e.key === 'Enter') {
      if (buffer.length > MIN_BARCODE_LENGTH) {
        const scannedCode = buffer
        buffer = ''
        console.log(`✅ [Renderer] Barcode: "${scannedCode}"`)
        window.api.testScan(scannedCode)
      } else {
        buffer = ''
      }
      return
    }

    // รับ printable characters (ความยาว 1) และ .
    if (e.key.length === 1) {
      buffer += e.key
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    console.log('📡 [Renderer] Scanner listener active')
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
  })
}

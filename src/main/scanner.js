const { GlobalKeyboardListener } = require('node-global-key-listener')
const { getScanThresholdMs } = require('./config')

const listener = new GlobalKeyboardListener()
let buffer = ''
let lastKeyTime = 0
const SCAN_THRESHOLD_MS = getScanThresholdMs() // ดึงค่าจาก config (.env)

/**
 * ตรวจสอบว่าเป็นตัวเลขหรือตัวอักษรภาษาอังกฤษหรือไม่
 * @param {string} key - ตัวอักษรที่กด
 * @returns {boolean}
 */
function isValidChar(key) {
  return /^[a-zA-Z0-9]$/.test(key)
}

/**
 * เริ่มต้นการดักจับบาร์โค้ด
 * @param {Function} onScan - callback function เมื่อสแกนสำเร็จ
 */
function initScanner(onScan) {
  console.log('📡 Scanner initialized - กำลังรอสแกนบาร์โค้ด...')
  
  listener.addListener((e) => {
    const now = Date.now()
    const key = e.name
    
    // ถ้าห่างกันเกิน threshold ให้ล้าง buffer (คนพิมพ์ปกติ)
    if (now - lastKeyTime > SCAN_THRESHOLD_MS && buffer.length > 0) {
      buffer = ''
    }
    
    lastKeyTime = now
    
    // กรองเฉพาะตัวเลขและตัวอักษร A-Z, a-z
    if (key && isValidChar(key)) {
      buffer += key
    }
    
    // ตรวจจับ Enter key และ buffer มีความยาว > 5
    if ((key === 'RETURN' || key === 'ENTER') && buffer.length > 5) {
      const scannedCode = buffer
      buffer = '' // ล้าง buffer
      
      console.log(`✅ Barcode scanned: ${scannedCode}`)
      
      if (typeof onScan === 'function') {
        onScan(scannedCode)
      }
    }
    
    // ถ้ากด Enter แต่ buffer สั้นเกินไป ให้ล้างทิ้ง
    if ((key === 'RETURN' || key === 'ENTER') && buffer.length <= 5) {
      buffer = ''
    }
  })
}

/**
 * หยุดการดักจับ
 */
function stopScanner() {
  listener.kill()
  console.log('🛑 Scanner stopped')
}

module.exports = {
  initScanner,
  stopScanner
}

const { contextBridge, ipcRenderer } = require('electron')

// สะพานเชื่อมระหว่าง Main process กับ Renderer process
contextBridge.exposeInMainWorld('api', {
  // ============ Config APIs ============
  
  /**
   * บันทึกการตั้งค่า (token, stationId, baseUrl, stationName)
   * @param {Object} config - { token, stationId, baseUrl, stationName }
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  
  /**
   * ดึงการตั้งค่าปัจจุบัน
   * @returns {Promise<Object>}
   */
  getConfig: () => ipcRenderer.invoke('config:get'),
  
  /**
   * ล้างการตั้งค่าทั้งหมด (logout)
   * @returns {Promise<{success: boolean}>}
   */
  clearConfig: () => ipcRenderer.invoke('config:clear'),
  
  // ============ Auth APIs ============
  
  /**
   * Login เข้าสู่ระบบ
   * @param {string} email - อีเมล
   * @param {string} password - รหัสผ่าน
   * @param {boolean} rememberMe - จดจำการเข้าสู่ระบบ
   * @returns {Promise<Object>} - { success, data: { user, token }, message }
   */
  login: (email, password, rememberMe) => 
    ipcRenderer.invoke('auth:login', { email, password, rememberMe }),
  
  /**
   * ตรวจสอบว่า token ยังใช้งานได้หรือไม่
   * @returns {Promise<Object>} - { success, data: { user }, message }
   */
  verifyToken: () => ipcRenderer.invoke('auth:verify'),
  
  // ============ Station APIs ============
  
  /**
   * ดึงรายการจุดตรวจที่ผู้ใช้มีสิทธิ์เข้าถึง
   * @returns {Promise<Object>} - { success, data: [...] }
   */
  getStations: () => ipcRenderer.invoke('stations:get'),
  
  // ============ Event Listeners ============
  
  /**
   * รอรับข้อมูลเมื่อสแกนบาร์โค้ดสำเร็จ
   * @param {Function} callback - fn({ success, patientName, data, timestamp })
   */
  onScanSuccess: (callback) => {
    ipcRenderer.on('scan:success', (event, data) => callback(data))
  },
  
  /**
   * รอรับข้อมูลเมื่อเกิด error
   * @param {Function} callback - fn({ success, error, status, timestamp })
   */
  onScanError: (callback) => {
    ipcRenderer.on('scan:error', (event, data) => callback(data))
  },
  
  /**
   * ลบ event listener (สำหรับ cleanup)
   */
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('scan:success')
    ipcRenderer.removeAllListeners('scan:error')
  }
})

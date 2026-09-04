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
  loginMicrosoft: () => ipcRenderer.invoke('auth:microsoft'),
  
  // ============ Station APIs ============
  
  /**
   * ดึงรายการจุดตรวจที่ผู้ใช้มีสิทธิ์เข้าถึง
   * @returns {Promise<Object>} - { success, data: [...] }
   */
  getStations: (search) => ipcRenderer.invoke('stations:get', search),

  // ============ CNGroup APIs ============

  /**
   * ดึงรายการ CNGroup สำหรับ dropdown
   * @returns {Promise<Object>} - { success, data: [...] }
   */
  getCNGroups: (search) => ipcRenderer.invoke('cngroups:get', search),

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
  testScan: (barcode) => ipcRenderer.invoke('scan:test', barcode),
  setScanPaused: (paused) => ipcRenderer.invoke('scan:setPaused', paused),
  cancelScan: (scanId) => ipcRenderer.invoke('scan:cancel', scanId),
  showNotification: (opts) => ipcRenderer.invoke('notify:show', opts),
  playSound: (name) => ipcRenderer.invoke('sound:play', name),

  onAuthExpired: (callback) => {
    ipcRenderer.once('auth:expired', () => callback())
  },

  lookupPatient: (cn, stationId) => ipcRenderer.invoke('patient:lookup', { cn, stationId }),
  getRemarkReasons: () => ipcRenderer.invoke('remark-reasons:get'),
  createStationRemark: (data) => ipcRenderer.invoke('station-remark:create', data),
  deleteStationRemark: (patientCNGroupId, stationId, cnGroupId) => ipcRenderer.invoke('station-remark:delete', { patientCNGroupId, stationId, cnGroupId }),

  // ============ Lab Recheck APIs ============

  /**
   * สร้าง ScanItem โดย Lab เอง หลังจาก recheck แล้วได้ notFound:true มา และผู้ใช้ยืนยันแล้ว
   * @returns {Promise<Object>}
   */
  recheckLabCreate: (barcode, cnGroupId) => ipcRenderer.invoke('recheck:labCreate', { barcode, cnGroupId }),
  cancelRecheck: (scanItemId) => ipcRenderer.invoke('recheck:cancel', scanItemId),
  getRecheckSummary: (cnGroupId) => ipcRenderer.invoke('recheck:summary', cnGroupId),

  /**
   * รอรับผลตอน recheck สำเร็จ (ทั้ง recheck ปกติ และ lab-create)
   * @param {Function} callback - fn({ success, isNewRecheck, patientName, data, timestamp })
   */
  onRecheckResult: (callback) => {
    ipcRenderer.on('recheck:result', (_, data) => callback(data))
  },
  onRecheckError: (callback) => {
    ipcRenderer.on('recheck:error', (_, data) => callback(data))
  },
  /**
   * รอรับตอนไม่พบ ScanItem จากหน้างาน — renderer ต้องถามผู้ใช้ก่อนว่าจะสร้างโดย Lab ไหม
   * แล้วเรียก recheckLabCreate เองถ้ายืนยัน
   * @param {Function} callback - fn({ barcode, cnGroupId, patient, station, timestamp })
   */
  onRecheckNotFound: (callback) => {
    ipcRenderer.on('recheck:notFound', (_, data) => callback(data))
  },

  onLog: (callback) => {
    ipcRenderer.on('app:log', (_, data) => callback(data))
  },

  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdaterStatus: (callback) => {
    ipcRenderer.on('updater:status', (_, data) => callback(data))
  }
})

const axios = require('axios')
const { getToken } = require('./store')
const { getApiBaseUrl } = require('./config')

// สร้าง axios instance
const api = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request Interceptor - ดึง token จาก store มาใส่ใน Header อัตโนมัติ
api.interceptors.request.use(
  (config) => {
    const token = getToken()
    const baseUrl = getApiBaseUrl()
    
    // ตั้งค่า baseURL ถ้ามี
    if (baseUrl) {
      config.baseURL = baseUrl
    }
    
    // แนบ Bearer Token เสมอ (สำคัญสำหรับ RBAC Check ที่ต้องมี Permission SCAN_CREATE)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response Interceptor - จัดการ error
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.status === 403) {
        console.error('RBAC Error: ไม่มีสิทธิ์ SCAN_CREATE')
      }
    }
    return Promise.reject(error)
  }
)

// ==========================================
// Auth APIs
// ==========================================

/**
 * Login เข้าสู่ระบบ
 * @param {string} email - อีเมล
 * @param {string} password - รหัสผ่าน
 * @param {boolean} rememberMe - จดจำการเข้าสู่ระบบ
 * @returns {Promise}
 */
async function login(email, password, rememberMe = false) {
  const baseUrl = getApiBaseUrl()
  
  const response = await api.post('/auth/login', {
    email,
    password,
    rememberMe
  }, {
    baseURL: baseUrl // ใช้ baseUrl จาก config ก่อน login
  })
  
  return response.data
}

// ==========================================
// Station APIs
// ==========================================

/**
 * ดึงรายการจุดตรวจ/สถานีทั้งหมดสำหรับ dropdown
 * @returns {Promise}
 */
async function getStations(search = '') {
  const params = new URLSearchParams({ isActive: 'true', limit: '100' })
  if (search) params.set('search', search)
  const response = await api.get(`/stations/dropdown?${params.toString()}`)
  return {
    success: true,
    data: response.data.data || []
  }
}

/**
 * ดึงรายการ CNGroup ทั้งหมดสำหรับ dropdown
 * @returns {Promise}
 */
async function getCNGroups(search = '') {
  const params = new URLSearchParams({ isActive: 'true', limit: '100' })
  if (search) params.set('search', search)
  const response = await api.get(`/cngroups/dropdown?${params.toString()}`)
  return {
    success: true,
    data: response.data.data || response.data || []
  }
}

// ==========================================
// Scan APIs
// ==========================================

/**
 * ส่งข้อมูลบาร์โค้ดไปยังเซิร์ฟเวอร์
 * ใช้ endpoint เดียว ส่ง mode ไปให้ backend จัดการ
 * @param {string} barcode - รหัสบาร์โค้ด (CN หรือ HN)
 * @param {number|string} stationId
 * @param {number|string} [cnGroupId] - บังคับ cnGroup ให้ตรง กัน CN ซ้ำข้าม cnGroup แล้วได้ผิดคน
 * @returns {Promise}
 */
async function sendScanData(barcode, stationId, cnGroupId) {
  if (!stationId) {
    throw new Error('ไม่ได้ตั้งค่า Station ID')
  }

  const payload = {
    cn: barcode,
    stationId: parseInt(stationId),
    scanType: 'WINAPP'
  }
  if (cnGroupId) payload.cnGroupId = cnGroupId

  // ปิดไว้: payload มี cn (รหัสผู้ป่วย) — เปิดใช้เฉพาะตอน debug
  // console.log(`📡 Sending scan to /scan/checkpoint (station ${stationId}):`, payload)
  return api.post('/scan/checkpoint', payload)
}

/**
 * ยกเลิก scan ที่ส่งไปแล้ว
 * @param {number|string} scanId - ID ของ scan record
 * @returns {Promise}
 */
async function lookupPatient(cn, stationId) {
  const response = await api.get(`/patient-lookups/lookup?cn=${encodeURIComponent(cn)}&stationId=${stationId}`)
  return response.data
}

async function getRemarkReasons() {
  const response = await api.get('/remark-reasons/active')
  return { success: true, data: response.data.data || response.data || [] }
}

async function createStationRemark(data) {
  const response = await api.post('/station-remarks', data)
  return response.data
}

async function cancelScan(scanId) {
  return api.delete(`/scan/${scanId}`)
}

async function deleteStationRemark(patientCNGroupId, stationId, cnGroupId) {
  const params = cnGroupId ? `?cnGroupId=${cnGroupId}` : ''
  const response = await api.delete(`/station-remarks/cng/${patientCNGroupId}/station/${stationId}${params}`)
  return response.data
}

// ==========================================
// Lab Recheck APIs
// ==========================================
// บาร์โค้ดของ Lab ก็เป็น CN.STATION_ID เหมือนกัน แต่ backend จะแยก parse เอง
// ไม่ต้องเลือกจุดตรวจในแอป — ใช้ station id ที่ฝังมาในบาร์โค้ดโดยตรง

/**
 * ยิง recheck — ถ้ามี ScanItem จากหน้างานอยู่แล้วจะเปลี่ยน source เป็น RECHECK ให้
 * ถ้าไม่พบเลย จะได้ notFound:true กลับมา (ไม่ throw) ให้ถามผู้ใช้ก่อนว่าจะสร้างโดย Lab ไหม
 * @param {string} barcode - รูปแบบ CN.STATION_ID เต็มๆ (ไม่ต้อง parse เอง)
 * @param {number|string} cnGroupId
 * @returns {Promise}
 */
async function recheckCheckpoint(barcode, cnGroupId) {
  const response = await api.post('/scan/recheck', { barcode, cnGroupId })
  return response.data
}

/**
 * สร้าง ScanItem ใหม่โดย Lab เอง (source=LAB_CREATED) — ใช้ตอน recheckCheckpoint คืน notFound:true
 * และผู้ใช้ยืนยันแล้วว่าจะสร้าง
 * @returns {Promise}
 */
async function recheckLabCreate(barcode, cnGroupId) {
  const response = await api.post('/scan/recheck/lab-create', { barcode, cnGroupId })
  return response.data
}

/**
 * ยกเลิก recheck — RECHECK จะคืนกลับเป็น STATION, LAB_CREATED จะถูกยกเลิกทั้งรายการ
 * @param {number|string} scanItemId
 * @returns {Promise}
 */
async function cancelRecheck(scanItemId) {
  const response = await api.delete(`/scan/recheck/${scanItemId}`)
  return response.data
}

/**
 * สรุปยอด recheck ของ CNGroup (ทั้งหมด/รอเช็ค/รับแล้ว แยกตามจุดตรวจ LAB)
 * @param {number|string} cnGroupId
 * @returns {Promise}
 */
async function getRecheckSummary(cnGroupId) {
  const response = await api.get(`/scan/recheck/summary?cnGroupId=${cnGroupId}`)
  return response.data
}

/**
 * เช็คว่า token ยังใช้งานได้หรือไม่ (เรียก /auth/me)
 * @returns {Promise}
 */
async function verifyToken() {
  const response = await api.get('/auth/me')
  return response.data
}

module.exports = {
  api,
  login,
  getStations,
  getCNGroups,
  sendScanData,
  cancelScan,
  verifyToken,
  lookupPatient,
  getRemarkReasons,
  createStationRemark,
  deleteStationRemark,
  recheckCheckpoint,
  recheckLabCreate,
  cancelRecheck,
  getRecheckSummary
}

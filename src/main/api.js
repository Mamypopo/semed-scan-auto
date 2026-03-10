const axios = require('axios')
const { getToken, getStationId } = require('./store')
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
    
    // แนบ Bearer Token เสมอ (สำคัญสำหรับ RBAC Check ที่ต้องมี Permission EXAM_RECORD)
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
      // 403 Forbidden - ไม่มีสิทธิ์ EXAM_RECORD
      if (error.response.status === 403) {
        console.error('RBAC Error: ไม่มีสิทธิ์ EXAM_RECORD')
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
async function getStations() {
  const response = await api.get('/stations/dropdown?isActive=true&limit=100')
  return {
    success: true,
    data: response.data.data || []
  }
}

// ==========================================
// Scan APIs
// ==========================================

/**
 * ส่งข้อมูลบาร์โค้ดไปยังเซิร์ฟเวอร์
 * ใช้ endpoint เดียว ส่ง mode ไปให้ backend จัดการ
 * @param {string} barcode - รหัสบาร์โค้ด (CN หรือ HN)
 * @returns {Promise}
 */
async function sendScanData(barcode) {
  const stationId = getStationId()
  const scanMode = getScanMode() || 'checkup'
  
  if (!stationId) {
    throw new Error('ไม่ได้ตั้งค่า Station ID')
  }
  
  // ใช้ endpoint เดียว
  const endpoint = '/scan'
  
  // ส่งทุกอย่างไปให้ backend จัดการ
  const payload = {
    barcode: barcode,        // รหัสที่สแกน (CN หรือ HN)
    stationId: parseInt(stationId),
    mode: scanMode,          // 'checkup' หรือ 'clinic'
    timestamp: new Date().toISOString()
  }
  
  console.log(`📡 Sending scan to ${endpoint}:`, payload)
  
  const response = await api.post(endpoint, payload)
  return response
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
  sendScanData,
  verifyToken
}

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

async function getCNGroups() {
  const response = await api.get('/cngroups/dropdown?isActive=true&limit=100')
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
 * @returns {Promise}
 */
async function sendScanData(barcode, stationId) {
  if (!stationId) {
    throw new Error('ไม่ได้ตั้งค่า Station ID')
  }

  const payload = {
    cn: barcode,
    stationId: parseInt(stationId),
    scanType: 'WINAPP'
  }

  console.log(`📡 Sending scan to /scan/checkpoint (station ${stationId}):`, payload)
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
  createStationRemark
}

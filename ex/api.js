import axios from 'axios'
import Swal from 'sweetalert2'
import { config } from '@/config/env'

// Create axios instance
const api = axios.create({
  baseURL: config.API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor
api.interceptors.request.use(
  config => {
    // Add auth token if available
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // ถ้าเป็น FormData ให้ลบ Content-Type header ออก (ให้ axios ตั้งให้อัตโนมัติ)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  response => {
    return response
  },
  error => {
    const status = error.response?.status
    const message = error.response?.data?.message

    // 401: token หมดอายุ / ไม่ถูกต้อง → เด้งไปหน้า login
    if (status === 401) {
      const currentPath = window.location.pathname
      if (!currentPath.includes('/auth') && !currentPath.includes('/login')) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        Swal.fire('หมดเวลาใช้งาน', message || 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง', 'warning').then(() => {
          window.location.href = '/auth'
        })
      }
    }

    // 403: ไม่มีสิทธิ์เข้าถึง → แจ้งเตือนด้วย SweetAlert กลางจอ
    if (status === 403) {
      Swal.fire('ไม่มีสิทธิ์เข้าถึง', message || 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้ของระบบ', 'error')
    }

    // 5xx: error จากฝั่ง server
    if (status >= 500) {
      console.error('Server error:', error.response?.data)
      Swal.fire('ผิดพลาด', 'ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง', 'error')
    }

    return Promise.reject(error)
  }
)

// Generic API methods
export const apiClient = {
  get: (url, params) => api.get(url, { params }),
  post: (url, data) => api.post(url, data),
  put: (url, data) => api.put(url, data),
  patch: (url, data) => api.patch(url, data),
  delete: (url, config = {}) => api.delete(url, config)
}

export const createHttp = (baseURL, extra = {}) =>
  axios.create({
    baseURL,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
    ...extra
  })

// Export api instance for direct use
export { api }

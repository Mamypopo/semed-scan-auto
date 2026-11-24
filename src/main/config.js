const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })
const { getConfig: getStoreConfig } = require('./store')

// ==========================================
// Environment Configuration
// รวมค่าจาก .env และ store เข้าด้วยกัน
// ==========================================

const envConfig = {
  // API
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',

  // Web (หน้าเว็บ ไม่ใช่ API) — ใช้เปิดหน้า CAPTCHA
  // ตัด / ท้าย และ /captcha-window ที่เผลอใส่มา (โค้ดเติม path ให้เอง)
  webBaseUrl: (process.env.WEB_BASE_URL || '').trim().replace(/\/+$/, '').replace(/\/captcha-window$/, ''),

  // Notification
  enableSound: process.env.ENABLE_SOUND === 'true'
}

/**
 * ดึงค่า API Base URL
 * ลำดับความสำคัญ: Store > Env > Default
 */
function getApiBaseUrl() {
  const storeConfig = getStoreConfig()
  return storeConfig.baseUrl || envConfig.apiBaseUrl
}

/**
 * ดึงค่า Web Base URL (โดเมนหน้าเว็บ ใช้เปิดหน้า CAPTCHA) — คืน '' ถ้าไม่ได้ตั้ง
 */
function getWebBaseUrl() {
  return envConfig.webBaseUrl
}

/**
 * ดึงค่าการตั้งค่าเสียงแจ้งเตือน
 */
function isSoundEnabled() {
  return envConfig.enableSound
}

/**
 * ดึงค่า config ที่รวม store + env
 */
function getMergedConfig() {
  const storeConfig = getStoreConfig()
  return {
    ...envConfig,
    token: storeConfig.token,
    stationIds: storeConfig.stationIds || [],
    cnGroupId: storeConfig.cnGroupId || null,
    workflowMode: storeConfig.workflowMode || null,
    baseUrl: storeConfig.baseUrl || envConfig.apiBaseUrl
  }
}

module.exports = {
  getApiBaseUrl,
  getWebBaseUrl,
  isSoundEnabled,
  getMergedConfig
}

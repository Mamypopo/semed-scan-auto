require('dotenv').config()
const { getConfig: getStoreConfig } = require('./store')

// ==========================================
// Environment Configuration
// รวมค่าจาก .env และ store เข้าด้วยกัน
// ==========================================

const envConfig = {
  // API
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  
  // Default values
  defaultStationId: process.env.DEFAULT_STATION_ID || '',
  
  // Scanner
  scanThresholdMs: parseInt(process.env.SCAN_THRESHOLD_MS) || 50,
  
  // Notification
  enableSound: process.env.ENABLE_SOUND === 'true',
  
  // App
  nodeEnv: process.env.NODE_ENV || 'development',
  openDevtools: process.env.OPEN_DEVTOOLS === 'true'
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
 * ดึงค่า Station ID
 * ลำดับความสำคัญ: Store > Env > Empty
 */
function getStationId() {
  const storeConfig = getStoreConfig()
  return storeConfig.stationId || envConfig.defaultStationId
}

/**
 * ดึงค่า Scanner Threshold
 */
function getScanThresholdMs() {
  return envConfig.scanThresholdMs
}

/**
 * ดึงค่าการตั้งค่าเสียงแจ้งเตือน
 */
function isSoundEnabled() {
  return envConfig.enableSound
}

/**
 * ตรวจสอบว่าอยู่ในโหมด development หรือไม่
 */
function isDevelopment() {
  return envConfig.nodeEnv === 'development'
}

/**
 * ตรวจสอบว่าควรเปิด DevTools หรือไม่
 */
function shouldOpenDevtools() {
  return envConfig.openDevtools
}

/**
 * ดึงค่า config ทั้งหมดจาก env
 */
function getEnvConfig() {
  return { ...envConfig }
}

/**
 * ดึงค่า config ที่รวม store + env
 */
function getMergedConfig() {
  const storeConfig = getStoreConfig()
  return {
    ...envConfig,
    token: storeConfig.token,
    stationId: storeConfig.stationId || envConfig.defaultStationId,
    stationName: storeConfig.stationName,
    baseUrl: storeConfig.baseUrl || envConfig.apiBaseUrl
  }
}

module.exports = {
  getApiBaseUrl,
  getStationId,
  getScanThresholdMs,
  isSoundEnabled,
  isDevelopment,
  shouldOpenDevtools,
  getEnvConfig,
  getMergedConfig
}

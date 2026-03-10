/**
 * SEMed Scanner - Renderer Process
 * หน้า UI: Login → Select Station → Scanner
 */

// ==========================================
// State
// ==========================================
const state = {
  user: null,
  token: null,
  stations: [],
  selectedStation: null,
  scanMode: 'checkup', // 'checkup' หรือ 'clinic'
  scanHistory: [],
  serverUrl: ''
}

// ==========================================
// DOM Elements
// ==========================================
const $ = (id) => document.getElementById(id)

const pages = {
  login: $('loginPage'),
  station: $('stationPage'),
  scanner: $('scannerPage')
}

const elements = {
  // Login
  loginEmail: $('loginEmail'),
  loginPassword: $('loginPassword'),
  rememberMe: $('rememberMe'),
  loginBtn: $('loginBtn'),
  loginSpinner: $('loginSpinner'),
  togglePassword: $('togglePassword'),
  
  // Header
  userInfoHeader: $('userInfoHeader'),
  headerUserName: $('headerUserName'),
  headerLogoutBtn: $('headerLogoutBtn'),
  
  // Station
  userInfo: $('userInfo'),
  userName: $('userName'),
  userRole: $('userRole'),
  stationsList: $('stationsList'),
  logoutFromStation: $('logoutFromStation'),
  
  // Scanner
  stationName: $('stationName'),
  scanModeCheckup: $('scanModeCheckup'),
  scanModeClinic: $('scanModeClinic'),
  resultContent: $('resultContent'),
  historyList: $('historyList'),
  clearHistoryBtn: $('clearHistoryBtn'),
  changeStationBtn: $('changeStationBtn'),
  
  // Status
  statusDot: document.querySelector('.status-dot'),
  statusText: document.querySelector('.status-text'),
  
  // Toast
  toast: $('toast'),
  toastIcon: $('toastIcon'),
  toastTitle: $('toastTitle'),
  toastText: $('toastText')
}

// ==========================================
// Initialization
// ==========================================
async function init() {
  console.log('🚀 SEMed Scanner initialized')
  
  // โหลดการตั้งค่า (รวมถึง server URL จาก .env)
  await loadConfig()
  
  // ตรวจสอบว่ามีการ login อยู่หรือไม่
  await checkAuthStatus()
  
  // ผูก Event Listeners
  bindEvents()
  
  // รอรับ event จาก Main Process
  setupIpcListeners()
}

// ==========================================
// Navigation
// ==========================================
function showPage(pageName) {
  // ซ่อนทุกหน้า
  Object.values(pages).forEach(page => page.style.display = 'none')
  
  // แสดงหน้าที่ต้องการ
  pages[pageName].style.display = 'block'
  
  // Update status
  const statusMap = {
    login: 'offline',
    station: 'online',
    scanner: 'scanning'
  }
  updateStatus(statusMap[pageName])
}

// ==========================================
// Config & Auth
// ==========================================
async function loadConfig() {
  try {
    const config = await window.api.getConfig()
    state.serverUrl = config.baseUrl || config.apiBaseUrl || ''
  } catch (error) {
    console.error('Error loading config:', error)
  }
}

function updateHeaderUser() {
  if (state.user) {
    elements.headerUserName.textContent = state.user.name || state.user.email
    elements.userInfoHeader.style.display = 'flex'
  } else {
    elements.userInfoHeader.style.display = 'none'
  }
}

async function checkAuthStatus() {
  try {
    const config = await window.api.getConfig()
    console.log('📋 Loaded config:', { 
      hasToken: !!config.token, 
      hasStationId: !!config.stationId,
      stationId: config.stationId 
    })
    
    // ถ้ามี token ให้เช็คก่อนว่ายังใช้ได้ไหม
    if (config.token) {
      console.log('🔍 Checking token validity...')
      const verifyResult = await window.api.verifyToken()
      
      console.log('🔍 Verify result:', verifyResult)
      
      if (!verifyResult.success) {
        console.log('❌ Token invalid:', verifyResult.message)
        // Token ไม่ผ่าน ให้ clear และไปหน้า login
        await window.api.clearConfig()
        showToast('warning', 'เซสชันหมดอายุ', 'กรุณาเข้าสู่ระบบใหม่')
        showPage('login')
        return
      }
      
      console.log('✅ Token valid, user:', verifyResult.data?.user?.email)
      state.user = verifyResult.data?.user
      state.token = config.token
      
      // โหลดโหมดที่เคยเลือกไว้
      if (config.scanMode) {
        state.scanMode = config.scanMode
        setScanMode(config.scanMode)
      }
      
      // ถ้ามี stationId ด้วย ไปหน้าสแกนเลย
      if (config.stationId) {
        state.selectedStation = { id: config.stationId, name: config.stationName || config.stationId }
        elements.stationName.textContent = state.selectedStation.name
        console.log('📍 Going to scanner page')
        showPage('scanner')
      } else {
        // มี token แต่ยังไม่เลือกจุดตรวจ
        console.log('📍 Going to station selection')
        await loadStations()
        showPage('station')
      }
    } else {
      console.log('❌ No token found, going to login')
      showPage('login')
    }
  } catch (error) {
    console.error('Error checking auth:', error)
    showPage('login')
  }
}

// ==========================================
// Login
// ==========================================
async function handleLogin() {
  const email = elements.loginEmail.value.trim()
  const password = elements.loginPassword.value
  const rememberMe = elements.rememberMe.checked
  
  if (!email || !password) {
    showToast('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกอีเมลและรหัสผ่าน')
    return
  }
  
  setLoading(true)
  
  try {
    const result = await window.api.login(email, password, rememberMe)
    
    if (result.success) {
      state.user = result.data.user
      state.token = result.data.token
      
      // บันทึก token ลง store ทันที
      console.log('💾 Saving token after login...')
      await window.api.saveConfig({
        token: state.token
      })
      console.log('💾 Token saved')
      
      showToast('success', 'เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับ ${result.data.user.name || result.data.user.email}`)
      
      // แสดง user ใน header
      updateHeaderUser()
      
      // ไปหน้าเลือกจุดตรวจ
      await loadStations()
      showPage('station')
    } else {
      showToast('error', 'เข้าสู่ระบบไม่สำเร็จ', result.message || 'กรุณาตรวจสอบอีเมลและรหัสผ่าน')
    }
  } catch (error) {
    console.error('Login error:', error)
    const errorMsg = error.message || error.response?.data?.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
    showToast('error', 'เกิดข้อผิดพลาด', errorMsg)
  } finally {
    setLoading(false)
  }
}

function setLoading(loading) {
  elements.loginBtn.disabled = loading
  elements.loginSpinner.style.display = loading ? 'inline-block' : 'none'
}

function togglePasswordVisibility() {
  const type = elements.loginPassword.type === 'password' ? 'text' : 'password'
  elements.loginPassword.type = type
  elements.togglePassword.textContent = type === 'password' ? '👁️' : '🙈'
}

// ==========================================
// Stations
// ==========================================
async function loadStations() {
  // แสดง user info
  if (state.user) {
    elements.userName.textContent = state.user.name || state.user.email
    elements.userRole.textContent = state.user.role || 'ผู้ใช้งาน'
  }
  
  // ดึงรายการจุดตรวจ
  try {
    const result = await window.api.getStations()
    
    if (result.success) {
      state.stations = result.data
      renderStations()
    } else {
      elements.stationsList.innerHTML = `
        <div class="error-state">
          <p>ไม่สามารถโหลดรายการจุดตรวจได้</p>
          <button class="btn btn-secondary" onclick="loadStations()">ลองใหม่</button>
        </div>
      `
    }
  } catch (error) {
    console.error('Error loading stations:', error)
    // ใช้ mock data ถ้า fetch ไม่ได้ (สำหรับ development)
    state.stations = [
      { id: 'ST001', name: 'จุดตรวจที่ 1 - แผนกตรวจทั่วไป', code: 'CK01', department: 'OPD' },
      { id: 'ST002', name: 'จุดตรวจที่ 2 - X-Ray', code: 'XR01', department: 'Radiology' },
      { id: 'ST003', name: 'จุดตรวจที่ 3 - Lab', code: 'LAB01', department: 'Laboratory' }
    ]
    renderStations()
  }
}

function renderStations() {
  if (state.stations.length === 0) {
    elements.stationsList.innerHTML = `
      <div class="empty-state">
        <p>ไม่พบจุดตรวจ</p>
      </div>
    `
    return
  }
  
  elements.stationsList.innerHTML = state.stations.map(station => {
    // สร้าง badge ถ้าเป็นจุดพิเศษ
    const specialBadge = station.isSpecial 
      ? `<span class="special-badge">${station.specialType || 'พิเศษ'}</span>` 
      : ''
    
    // แสดงกลุ่ม/แผนก ถ้ามี
    const groupInfo = station.stationGroup 
      ? `<div class="station-group">${station.stationGroup}</div>` 
      : ''
    
    // ใช้ data attributes แทน onclick
    return `
    <div class="station-item" data-id="${station.id}" data-name="${station.name}">
      <div class="station-icon">🏥</div>
      <div class="station-info">
        <div class="station-name">${station.name} ${specialBadge}</div>
        ${groupInfo}
      </div>
      <div class="station-arrow">→</div>
    </div>
  `}).join('')
  
  // เพิ่ม event listeners แบบไม่ใช่ inline
  const stationItems = elements.stationsList.querySelectorAll('.station-item')
  stationItems.forEach(item => {
    item.addEventListener('click', () => {
      const stationId = item.dataset.id
      const stationName = item.dataset.name
      selectStation(stationId, stationName)
    })
  })
}

async function selectStation(stationId, stationName) {
  state.selectedStation = { id: stationId, name: stationName }
  
  // บันทึกลง store
  try {
    console.log('💾 Saving config:', { hasToken: !!state.token, stationId, stationName })
    const result = await window.api.saveConfig({
      token: state.token,
      stationId: stationId,
      stationName: stationName,
      scanMode: state.scanMode
    })
    console.log('💾 Save result:', result)
    
    elements.stationName.textContent = stationName
    showPage('scanner')
    showToast('success', 'เลือกจุดตรวจสำเร็จ', stationName)
  } catch (error) {
    console.error('❌ Save config error:', error)
    showToast('error', 'เกิดข้อผิดพลาด', error.message)
  }
}

// ==========================================
// Scan Mode
// ==========================================
function setScanMode(mode) {
  state.scanMode = mode
  
  // Update UI
  elements.scanModeCheckup.classList.toggle('active', mode === 'checkup')
  elements.scanModeClinic.classList.toggle('active', mode === 'clinic')
  
  // Save to store
  window.api.saveConfig({ scanMode: mode }).catch(console.error)
  
  console.log('🔄 Scan mode changed:', mode)
}

// ==========================================
// Logout
// ==========================================
async function handleLogout() {
  try {
    await window.api.clearConfig()
    
    // Reset state
    state.user = null
    state.token = null
    state.selectedStation = null
    state.scanHistory = []
    
    // Reset form
    elements.loginEmail.value = ''
    elements.loginPassword.value = ''
    elements.rememberMe.checked = false
    
    // ซ่อน user ใน header
    updateHeaderUser()
    
    showPage('login')
    showToast('info', 'ออกจากระบบ', 'คุณได้ออกจากระบบแล้ว')
  } catch (error) {
    showToast('error', 'เกิดข้อผิดพลาด', error.message)
  }
}

// ==========================================
// Scanner & Results
// ==========================================
function updateLastScan(scanData) {
  if (scanData.success) {
    const date = new Date(scanData.timestamp)
    const timeStr = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    
    elements.resultContent.className = 'result-content success'
    elements.resultContent.innerHTML = `
      <div class="patient-name">${scanData.patientName}</div>
      <div class="scan-time">สแกนเมื่อ: ${timeStr}</div>
    `
  } else {
    elements.resultContent.className = 'result-content error'
    elements.resultContent.innerHTML = `
      <div class="error-message">❌ ${scanData.error}</div>
      <div class="scan-time">กรุณาลองใหม่อีกครั้ง</div>
    `
  }
}

function addToHistory(item) {
  state.scanHistory.unshift(item)
  if (state.scanHistory.length > 20) {
    state.scanHistory = state.scanHistory.slice(0, 20)
  }
  renderHistory()
}

function renderHistory() {
  if (state.scanHistory.length === 0) {
    elements.historyList.innerHTML = '<p class="empty-state">ยังไม่มีประวัติการสแกน</p>'
    elements.clearHistoryBtn.style.display = 'none'
    return
  }
  
  elements.clearHistoryBtn.style.display = 'block'
  
  elements.historyList.innerHTML = state.scanHistory.map(item => {
    const date = new Date(item.timestamp)
    const timeStr = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    
    return `
      <div class="history-item ${item.success ? 'success' : 'error'}">
        <div class="history-icon">${item.success ? '✅' : '❌'}</div>
        <div class="history-info">
          <div class="history-patient">${item.patientName}</div>
          ${item.barcode ? `<div class="history-barcode">${item.barcode}</div>` : ''}
        </div>
        <div class="history-time">${timeStr}</div>
      </div>
    `
  }).join('')
}

function clearHistory() {
  state.scanHistory = []
  renderHistory()
}

// ==========================================
// IPC Event Listeners (จาก Main Process)
// ==========================================
function setupIpcListeners() {
  // สแกนสำเร็จ
  window.api.onScanSuccess((data) => {
    console.log('✅ Scan success:', data)
    
    const patientName = data.patientName || 'ไม่ทราบชื่อ'
    
    updateLastScan({
      success: true,
      patientName,
      data: data.data,
      timestamp: data.timestamp
    })
    
    addToHistory({
      success: true,
      patientName,
      barcode: data.data?.barcode,
      timestamp: data.timestamp
    })
    
    showToast('success', 'สแกนสำเร็จ', patientName)
  })
  
  // สแกน error
  window.api.onScanError((data) => {
    console.error('❌ Scan error:', data)
    
    updateLastScan({
      success: false,
      error: data.error,
      timestamp: data.timestamp
    })
    
    addToHistory({
      success: false,
      patientName: 'เกิดข้อผิดพลาด',
      barcode: data.error,
      timestamp: data.timestamp
    })
    
    showToast('error', 'เกิดข้อผิดพลาด', data.error)
  })
}

// ==========================================
// UI Utilities
// ==========================================
function updateStatus(status) {
  elements.statusDot.className = 'status-dot ' + status
  
  const statusText = {
    online: 'ออนไลน์',
    offline: 'ออฟไลน์',
    scanning: 'พร้อมสแกน'
  }
  
  elements.statusText.textContent = statusText[status] || status
}

function showToast(type, title, message) {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }
  
  elements.toastIcon.textContent = icons[type] || icons.info
  elements.toastTitle.textContent = title
  elements.toastText.textContent = message
  
  elements.toast.classList.add('show')
  
  setTimeout(() => {
    elements.toast.classList.remove('show')
  }, 3000)
}

// ==========================================
// Event Binding
// ==========================================
function bindEvents() {
  // Login
  elements.loginBtn.addEventListener('click', handleLogin)
  elements.togglePassword.addEventListener('click', togglePasswordVisibility)
  
  // Enter key
  elements.loginPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin()
  })
  elements.loginEmail.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') elements.loginPassword.focus()
  })
  
  // Station
  elements.logoutFromStation.addEventListener('click', handleLogout)
  
  // Header
  elements.headerLogoutBtn.addEventListener('click', handleLogout)
  
  // Scanner
  elements.changeStationBtn?.addEventListener('click', () => showPage('station'))
  elements.clearHistoryBtn.addEventListener('click', clearHistory)
  
  // Scan Mode
  elements.scanModeCheckup?.addEventListener('click', () => setScanMode('checkup'))
  elements.scanModeClinic?.addEventListener('click', () => setScanMode('clinic'))
}

// ==========================================
// Expose functions for onclick
// ==========================================
window.selectStation = selectStation
window.loadStations = loadStations

// ==========================================
// Start
// ==========================================
document.addEventListener('DOMContentLoaded', init)

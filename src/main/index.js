const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const { showNotification } = require('./notifier')

const { saveConfig, clearConfig, getStationIds, getScanInputMode } = require('./store')
const { playSound } = require('./sound')
const { getMergedConfig, shouldOpenDevtools, isSoundEnabled, getApiBaseUrl } = require('./config')
const { login, getStations, sendScanData, cancelScan, verifyToken, lookupPatient, getRemarkReasons, createStationRemark } = require('./api')
const { initScanner } = require('./scanner')

let mainWindow

function sendLog(level, message, detail = null) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:log', {
      level,
      message,
      detail,
      time: new Date().toISOString()
    })
  }
}

function createWindow() {
  Menu.setApplicationMenu(null)
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev')
  
  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    minWidth: 400,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fafaf9'
  })

  // Request notification permission on Windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.hospital.semed-scanner')
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../out/renderer/index.html'))
  }
}

// ==========================================
// Windows Notifications
// ==========================================

/**
 * แจ้งเตือนสำเร็จ
 */
function notifySuccess(data) {
  const p = data?.patient
  const patientName = p
    ? `${p.prefix || ''} ${p.first_name || ''} ${p.last_name || ''}`.trim()
    : data?.patientName || 'ไม่ทราบชื่อ'
  
  const isDuplicate = data?.isNewScan === false
  const title = isDuplicate ? '🔁 สแกนซ้ำ' : '✅ สแกนสำเร็จ'
  const cn = data?.membership?.cn || ''
  const stationName = data?.station?.name || ''
  const body = [
    `ผู้ป่วย: ${patientName}`,
    cn ? `CN: ${cn}` : null,
    stationName ? `จุดตรวจ: ${stationName}` : null
  ].filter(Boolean).join('\n')

  showNotification({ type: isDuplicate ? 'warning' : 'success', title, body })
  
  sendLog('success', `สแกนสำเร็จ: ${patientName}`, data?.station?.name ? `Station: ${data.station.name}` : null)

  // เล่นเสียง
  if (isSoundEnabled()) {
    playSound(data?.isNewScan === false ? 'duplicate' : 'success')
  }

  // ส่งไปยัง Renderer (Vue)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('scan:success', {
      success: true,
      patientName,
      data,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * แจ้งเตือน Error
 */
function notifyError(error) {
  let message = error.response?.data?.message || error.response?.data?.error || error.message
  let title = '❌ เกิดข้อผิดพลาด'

  if (error.response) {
    const status = error.response.status
    if (status === 401) {
      console.warn('🔒 Token หมดอายุ — kick renderer ออก')
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auth:expired')
      }
      return
    }
    if (status === 403) {
      title = '⛔ ไม่มีสิทธิ์'
      message = 'คุณไม่มีสิทธิ์ SCAN_CREATE'
    } else if (status === 404) {
      title = '❌ ไม่พบข้อมูล'
      message = message || 'ไม่พบผู้ป่วยจากบาร์โค้ดนี้'
    }
  }
  
  const errStatus = error.response?.status
  const errDetail = error.response?.data?.message || error.response?.data?.error || error.message
  const errBody = error.response?.data ? JSON.stringify(error.response.data) : null
  sendLog('error', `${title}: ${message}${errStatus ? ` [${errStatus}]` : ''}`, errBody || errDetail)

  // เล่นเสียง error
  if (isSoundEnabled()) playSound('error')

  showNotification({ type: 'error', title, body: message })
  
  // ส่งไปยัง Renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('scan:error', {
      success: false,
      error: message,
      status: error.response?.status,
      timestamp: new Date().toISOString()
    })
  }
}

// ==========================================
// Scanner Handler
// ==========================================

let lastScanBarcode = ''
let lastScanTime = 0

async function handleScan(barcode) {
  // ออกจาก koffi hook callback context ก่อน เพื่อให้ Electron API ทำงานได้ปลอดภัย
  await new Promise(resolve => setImmediate(resolve))

  // ป้องกัน double scan (global + renderer ทำงานพร้อมกัน)
  const now = Date.now()
  if (barcode === lastScanBarcode && now - lastScanTime < 1000) return
  lastScanBarcode = barcode
  lastScanTime = now

  let cn = barcode
  let stationIds = getStationIds()
  const inputMode = getScanInputMode() // 'auto' | 'manual'

  // แยก CN กับ stationId ที่อาจฝังในบาร์โค้ด เช่น "691220014.16"
  if (barcode.includes('.')) {
    const parts = barcode.split('.')
    const embeddedStationId = parseInt(parts[parts.length - 1])
    if (!isNaN(embeddedStationId)) {
      cn = parts.slice(0, -1).join('.')
      if (inputMode === 'auto') {
        // ถ้าเลือก station ไว้ ต้องตรงกับ embedded stationId ถึงจะยิงได้
        const selectedIds = stationIds
        if (selectedIds.length > 0 && !selectedIds.includes(embeddedStationId)) {
          console.warn(`⛔ stationId mismatch: barcode=${embeddedStationId} selected=${JSON.stringify(selectedIds)}`)
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('scan:error', {
              success: false,
              error: `บาร์โค้ดนี้เป็นของจุดตรวจ #${embeddedStationId} ไม่ตรงกับที่เลือก`,
              timestamp: new Date().toISOString()
            })
          }
          return
        }
        stationIds = [embeddedStationId]
        console.log(`🔍 [Auto] cn="${cn}" stationId=${embeddedStationId}`)
      } else {
        // Manual: ใช้ stationIds จาก UI, ส่งแค่ CN ที่ตัด suffix ออกแล้ว
        console.log(`🔍 [Manual] cn="${cn}" stations=${JSON.stringify(stationIds)}`)
      }
    }
  }

  console.log(`🔎 mode="${inputMode}" stationIds=${JSON.stringify(stationIds)} cn="${cn}"`)

  if (!stationIds.length) {
    showNotification({ type: 'error', title: '⚠️ ไม่มีจุดตรวจ', body: 'กรุณาเลือกจุดตรวจก่อนสแกน' })
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan:error', {
        success: false,
        error: 'กรุณาเลือกจุดตรวจก่อนสแกน',
        timestamp: new Date().toISOString()
      })
    }
    return
  }

  console.log(`🔄 สแกน: cn="${cn}" → ${stationIds.length} จุดตรวจ`)
  const results = await Promise.allSettled(
    stationIds.map(id => sendScanData(cn, id))
  )

  const fulfilled = results.filter(r => r.status === 'fulfilled')
  if (fulfilled.length > 0) {
    console.log('✅ สำเร็จ:', fulfilled[0].value.data)
    notifySuccess(fulfilled[0].value.data)
  } else {
    const err = results[0].reason
    console.error('❌ ผิดพลาดทุก station')
    console.error('   status :', err?.response?.status)
    console.error('   message:', err?.response?.data?.message || err?.message)
    console.error('   data   :', JSON.stringify(err?.response?.data))
    notifyError(err)
  }
}

// ==========================================
// IPC Handlers
// ==========================================

ipcMain.handle('config:save', async (event, config) => {
  try {
    saveConfig(config)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('config:get', async () => {
  const config = getMergedConfig()
  return JSON.parse(JSON.stringify(config))
})

ipcMain.handle('config:clear', async () => {
  clearConfig()
  return { success: true }
})

ipcMain.handle('auth:login', async (event, { email, password, rememberMe }) => {
  const baseUrl = getApiBaseUrl()
  sendLog('info', `Login: ${email}`, `API: ${baseUrl}`)
  try {
    const result = await login(email, password, rememberMe)
    const returnValue = JSON.parse(JSON.stringify(result))
    if (returnValue.success !== false) {
      sendLog('success', `Login สำเร็จ: ${result.data?.user?.name || email}`)
    } else {
      sendLog('error', 'Login ล้มเหลว', returnValue.message || JSON.stringify(returnValue))
    }
    return returnValue
  } catch (error) {
    const status = error.response?.status
    const apiMsg = error.response?.data?.message || error.response?.data?.error
    const errMsg = apiMsg || error.message
    sendLog('error', `Login Error${status ? ` (${status})` : ''}`, `${errMsg}\n${baseUrl}/auth/login\n${JSON.stringify(error.response?.data || {})}`)
    return {
      success: false,
      message: errMsg
    }
  }
})

ipcMain.handle('auth:verify', async () => {
  try {
    const result = await verifyToken()
    sendLog('info', `Token OK: ${result.data?.user?.name || result.data?.name || ''}`)
    return JSON.parse(JSON.stringify({ success: true, data: result.data }))
  } catch (error) {
    const status = error.response?.status
    sendLog('warn', `Token verify ล้มเหลว${status ? ` (${status})` : ''}`, error.response?.data?.message || error.message)
    return {
      success: false,
      message: error.message,
      status
    }
  }
})

ipcMain.handle('notify:show', (event, { type, title, body }) => {
  showNotification({ type, title, body })
})

ipcMain.handle('scan:test', async (event, barcode) => {
  console.log(`🧪 Test scan triggered from UI: "${barcode}"`)
  sendLog('info', `Manual scan: "${barcode}"`)
  await handleScan(barcode)
  return { success: true }
})

ipcMain.handle('scan:cancel', async (event, scanId) => {
  try {
    const result = await cancelScan(scanId)
    console.log(`✅ ยกเลิก scan #${scanId} สำเร็จ`)
    return { success: true, data: result.data }
  } catch (error) {
    console.error('❌ ยกเลิก scan ล้มเหลว:', error.response?.data || error.message)
    return {
      success: false,
      message: error.response?.data?.message || error.message,
      status: error.response?.status
    }
  }
})

ipcMain.handle('auth:microsoft', async () => {
  return new Promise((resolve) => {
    const authWindow = new BrowserWindow({
      width: 480,
      height: 660,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:ms-auth'
      },
      parent: mainWindow,
      modal: true,
      title: 'Microsoft Login',
      autoHideMenuBar: true
    })
    authWindow.setMenu(null)

    let resolved = false
    const finish = (result) => {
      if (resolved) return
      resolved = true
      if (!authWindow.isDestroyed()) authWindow.close()
      resolve(result)
    }

    const checkUrl = (url) => {
      try {
        const u = new URL(url)
        const token = u.searchParams.get('token')
        const error = u.searchParams.get('error')
        const message = u.searchParams.get('message')
        if (token) {
          sendLog('success', 'Microsoft Login สำเร็จ')
          finish({ success: true, token })
        } else if (error) {
          const msg = message ? decodeURIComponent(message) : error
          sendLog('error', `Microsoft Login ล้มเหลว: ${msg}`)
          finish({ success: false, message: msg })
        }
      } catch {}
    }

    authWindow.webContents.on('will-redirect', (_, url) => checkUrl(url))
    authWindow.webContents.on('will-navigate', (_, url) => checkUrl(url))
    authWindow.webContents.on('did-navigate', (_, url) => checkUrl(url))
    authWindow.webContents.on('did-fail-load', (_, code, desc) => {
      sendLog('error', `Microsoft Login โหลดไม่ได้ (${code})`, desc)
      finish({ success: false, message: `เชื่อมต่อ server ไม่ได้ กรุณาตรวจสอบ backend (${desc})` })
    })
    authWindow.on('closed', () => finish({ success: false, message: 'ปิดหน้าต่างก่อนเข้าสู่ระบบ' }))

    const msUrl = `${getApiBaseUrl()}/auth/microsoft`
    sendLog('info', 'เปิดหน้า Microsoft Login', msUrl)
    authWindow.loadURL(msUrl)
  })
})

ipcMain.handle('stations:get', async () => {
  try {
    const result = await getStations()
    sendLog('info', `โหลดจุดตรวจ: ${result.data?.length || 0} รายการ`)
    return JSON.parse(JSON.stringify(result))
  } catch (error) {
    const status = error.response?.status
    sendLog('error', `โหลดจุดตรวจล้มเหลว${status ? ` (${status})` : ''}`, error.response?.data?.message || error.message)
    return { success: false, message: error.message }
  }
})

ipcMain.handle('patient:lookup', async (event, { cn, stationId }) => {
  try {
    const result = await lookupPatient(cn, stationId)
    return JSON.parse(JSON.stringify(result))
  } catch (error) {
    const status = error.response?.status
    return {
      success: false,
      message: status === 404
        ? 'ไม่พบผู้ป่วยจาก CN นี้ในจุดตรวจที่เลือก'
        : error.response?.data?.message || error.message
    }
  }
})

ipcMain.handle('remark-reasons:get', async () => {
  try {
    const result = await getRemarkReasons()
    return JSON.parse(JSON.stringify(result))
  } catch (error) {
    return { success: false, message: error.message }
  }
})

ipcMain.handle('station-remark:create', async (event, data) => {
  try {
    const result = await createStationRemark(data)
    return JSON.parse(JSON.stringify(result))
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message
    }
  }
})

// ==========================================
// App Lifecycle
// ==========================================

// ==========================================
// Auto Updater
// ==========================================

function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    sendLog('info', 'กำลังตรวจสอบอัพเดท...')
  })

  autoUpdater.on('update-available', (info) => {
    sendLog('info', `พบเวอร์ชันใหม่: ${info.version}`)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', { type: 'available', version: info.version })
    }
  })

  autoUpdater.on('update-not-available', () => {
    sendLog('info', 'แอปเป็นเวอร์ชันล่าสุดแล้ว')
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', { type: 'not-available' })
    }
  })

  autoUpdater.on('download-progress', (progress) => {
    const pct = Math.round(progress.percent)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', { type: 'downloading', percent: pct })
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendLog('success', `ดาวน์โหลดอัพเดทเสร็จ: ${info.version} — พร้อมติดตั้ง`)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', { type: 'downloaded', version: info.version })
    }
  })

  autoUpdater.on('error', (err) => {
    sendLog('error', 'ตรวจสอบอัพเดทล้มเหลว', err.message)
  })
}

ipcMain.handle('updater:check', async () => {
  try {
    await autoUpdater.checkForUpdates()
    return { success: true }
  } catch (err) {
    return { success: false, message: err.message }
  }
})

ipcMain.handle('updater:download', () => {
  autoUpdater.downloadUpdate()
})

ipcMain.handle('updater:install', () => {
  autoUpdater.quitAndInstall()
})

app.whenReady().then(() => {
  createWindow()
  initScanner(handleScan)

  mainWindow.webContents.once('did-finish-load', () => {
    sendLog('info', 'แอปเริ่มต้นแล้ว', `API: ${getApiBaseUrl()}`)
    const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev')
    if (!isDev) {
      setupAutoUpdater()
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((err) => {
          sendLog('error', 'ตรวจสอบอัพเดทล้มเหลว', err.message)
        })
      }, 3000)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

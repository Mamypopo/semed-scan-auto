const { app, BrowserWindow, ipcMain, Notification } = require('electron')
const path = require('path')
const notifier = require('node-notifier')

const { saveConfig, clearConfig, getStationIds, getScanInputMode } = require('./store')
const { playSound } = require('./sound')
const { getMergedConfig, shouldOpenDevtools, isSoundEnabled } = require('./config')
const { login, getStations, sendScanData, cancelScan, verifyToken } = require('./api')
const { initScanner } = require('./scanner')

let mainWindow

function createWindow() {
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
  
  // วิธีที่ 1: Electron Native Notification (แนะนำสำหรับ Windows 10/11)
  if (Notification.isSupported()) {
    new Notification({
      title: '✅ สแกนสำเร็จ',
      body: `ผู้ป่วย: ${patientName}`,
      icon: path.join(__dirname, '../../assets/icon.png'),
      silent: !isSoundEnabled(),
      timeoutType: 'default'
    }).show()
  } else {
    // วิธีที่ 2: node-notifier (สำรองสำหรับ Windows รุ่นเก่า)
    notifier.notify({
      title: '✅ สแกนสำเร็จ',
      message: `ผู้ป่วย: ${patientName}`,
      icon: path.join(__dirname, '../../assets/icon.png'),
      sound: isSoundEnabled(),
      wait: false
    })
  }
  
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
  let message = error.message
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
      message = 'ไม่พบผู้ป่วยจากบาร์โค้ดนี้'
    }
  }
  
  // เล่นเสียง error
  if (isSoundEnabled()) playSound('error')

  // Electron Native Notification
  if (Notification.isSupported()) {
    new Notification({
      title,
      body: message,
      icon: path.join(__dirname, '../../assets/icon.png'),
      silent: true
    }).show()
  } else {
    notifier.notify({
      title,
      message,
      icon: path.join(__dirname, '../../assets/icon.png'),
      sound: false,
      wait: false
    })
  }
  
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
let isCancelMode = false

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

  // Cancel mode: ส่ง CN ไป renderer ให้ค้นหาและยืนยันยกเลิก
  if (isCancelMode) {
    console.log(`🔍 Cancel mode — lookup cn="${cn}"`)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan:lookup-request', { cn, timestamp: new Date().toISOString() })
    }
    return
  }

  console.log(`🔎 mode="${inputMode}" stationIds=${JSON.stringify(stationIds)} cn="${cn}"`)

  if (!stationIds.length) {
    if (Notification.isSupported()) {
      new Notification({
        title: '⚠️ ไม่มีจุดตรวจ',
        body: 'กรุณาเลือกจุดตรวจก่อนสแกน',
        silent: true
      }).show()
    }
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
  try {
    const result = await login(email, password, rememberMe)
    return JSON.parse(JSON.stringify(result))
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message
    }
  }
})

ipcMain.handle('auth:verify', async () => {
  try {
    const result = await verifyToken()
    return JSON.parse(JSON.stringify({ success: true, data: result.data }))
  } catch (error) {
    return {
      success: false,
      message: error.message,
      status: error.response?.status
    }
  }
})

ipcMain.handle('scan:test', async (event, barcode) => {
  console.log(`🧪 Test scan triggered from UI: "${barcode}"`)
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

ipcMain.handle('scan:set-cancel-mode', (event, enabled) => {
  isCancelMode = !!enabled
  console.log(`🔄 Cancel mode: ${isCancelMode ? 'ON' : 'OFF'}`)
  return { success: true }
})

ipcMain.handle('stations:get', async () => {
  try {
    const result = await getStations()
    return JSON.parse(JSON.stringify(result))
  } catch (error) {
    return { success: false, message: error.message }
  }
})

// ==========================================
// App Lifecycle
// ==========================================

app.whenReady().then(() => {
  createWindow()
  initScanner(handleScan)

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

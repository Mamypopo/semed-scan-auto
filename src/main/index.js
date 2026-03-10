const { app, BrowserWindow, ipcMain, Notification } = require('electron')
const path = require('path')
const notifier = require('node-notifier')

const { saveConfig, clearConfig } = require('./store')
const { getMergedConfig, shouldOpenDevtools, isSoundEnabled } = require('./config')
const { login, getStations, sendScanData, verifyToken } = require('./api')
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
  const patientName = data?.patientName || data?.patient?.name || 'ไม่ทราบชื่อ'
  
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
    if (status === 403) {
      title = '⛔ ไม่มีสิทธิ์'
      message = 'คุณไม่มีสิทธิ์ EXAM_RECORD'
    } else if (status === 401) {
      title = '🔒 หมดอายุ'
      message = 'กรุณาเข้าสู่ระบบใหม่'
    } else if (status === 404) {
      title = '❌ ไม่พบข้อมูล'
      message = 'ไม่พบผู้ป่วยจากบาร์โค้ดนี้'
    }
  }
  
  // Electron Native Notification
  if (Notification.isSupported()) {
    new Notification({
      title,
      body: message,
      icon: path.join(__dirname, '../../assets/icon.png'),
      silent: !isSoundEnabled()
    }).show()
  } else {
    notifier.notify({
      title,
      message,
      icon: path.join(__dirname, '../../assets/icon.png'),
      sound: isSoundEnabled()
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

async function handleScan(barcode) {
  try {
    console.log(`🔄 กำลังส่งข้อมูล: ${barcode}`)
    const response = await sendScanData(barcode)
    console.log('✅ สำเร็จ:', response.data)
    notifySuccess(response.data)
  } catch (error) {
    console.error('❌ ผิดพลาด:', error.message)
    notifyError(error)
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

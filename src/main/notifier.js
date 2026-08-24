'use strict'

const { BrowserWindow, screen } = require('electron')
const path = require('path')
const { pathToFileURL } = require('url')

const WIDTH    = 310
const HEIGHT   = 100
const MARGIN   = 16
const GAP      = 8
const DURATION = 1500
const MAX_VISIBLE = 3

const active = []

function getBase() {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: workArea.x + workArea.width  - WIDTH  - MARGIN,
    y: workArea.y + workArea.height - MARGIN
  }
}

function restack() {
  const { x, y } = getBase()
  active.forEach(({ win }, i) => {
    if (!win.isDestroyed()) {
      win.setPosition(
        Math.round(x),
        Math.round(y - HEIGHT - i * (HEIGHT + GAP))
      )
    }
  })
}

function remove(entry) {
  const idx = active.indexOf(entry)
  if (idx !== -1) active.splice(idx, 1)
  clearTimeout(entry.timer)
  if (!entry.win.isDestroyed()) entry.win.close()
  restack()
}

function showNotification({ type = 'success', title = '', body = '' }) {
  // เก็บ toast ที่แสดงพร้อมกันไม่เกิน MAX_VISIBLE — ถ้าเกิน ปิดอันเก่าสุดทิ้งทันที
  // (log panel ในแอปเป็น source of truth ที่ครบอยู่แล้ว toast แค่เตือนสายตาแวบเดียว)
  while (active.length >= MAX_VISIBLE) {
    remove(active[0])
  }

  const { x, y } = getBase()
  const posY = y - HEIGHT - active.length * (HEIGHT + GAP)

  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x: Math.round(x),
    y: Math.round(posY),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false
    }
  })

  // 'screen-saver' คือระดับสูงสุดที่ Electron รองรับ — ช่วยให้ลอยเหนือโปรแกรมที่รัน
  // fullscreen (เช่น DRCC) ได้ดีกว่า alwaysOnTop เฉยๆ แต่ไม่การันตีเหนือ exclusive
  // fullscreen (DirectX) เพราะโปรแกรมแบบนั้นควบคุม GPU surface เองนอกเหนือ DWM
  win.setAlwaysOnTop(true, 'screen-saver')

  const params = new URLSearchParams({ type, title, body, duration: DURATION })
  const htmlFile = path.join(__dirname, '../../assets/notification.html')
  win.loadURL(`${pathToFileURL(htmlFile).href}?${params.toString()}`)

  win.once('ready-to-show', () => win.show())

  const entry = { win, timer: null }
  entry.timer = setTimeout(() => remove(entry), DURATION)
  active.push(entry)

  win.on('closed', () => {
    const idx = active.findIndex(e => e.win === win)
    if (idx !== -1) active.splice(idx, 1)
    restack()
  })
}

module.exports = { showNotification }

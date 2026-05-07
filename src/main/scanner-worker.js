'use strict'
// Raw Input API scanner worker — runs as plain Node.js child process
// Uses Windows RIDEV_INPUTSINK to capture keyboard globally (even in background)
// Uses PeekMessage polling (not blocking GetMessage) so Node.js I/O works correctly

const koffi = require('koffi')
const fs    = require('fs')

const SCAN_THRESHOLD_MS  = parseInt(process.env.SCAN_THRESHOLD_MS) || 50
const MIN_BARCODE_LENGTH = 5

// ── Win32 constants ────────────────────────────────────────
const WM_INPUT         = 0x00FF
const WM_DESTROY       = 0x0002
const RID_INPUT        = 0x10000003
const RIM_TYPEKEYBOARD = 1
const RIDEV_INPUTSINK  = 0x00000100
const RI_KEY_BREAK     = 0x0001
const PM_REMOVE        = 0x0001

// Virtual key codes
const VK_RETURN     = 0x0D
const VK_A = 0x41,  VK_Z = 0x5A
const VK_0 = 0x30,  VK_9 = 0x39
const VK_NUMPAD0 = 0x60, VK_NUMPAD9 = 0x69
const VK_DECIMAL    = 0x6E
const VK_OEM_PERIOD = 0xBE

// RAWINPUT keyboard field offsets (64-bit):
//   RAWINPUTHEADER = 24 bytes, then RAWKEYBOARD:
//   MakeCode(2) + Flags(2) + Reserved(2) + VKey(2) ...
const HDR_SIZE  = 24
const FLAGS_OFF = 26  // HDR_SIZE + 2
const VKEY_OFF  = 30  // HDR_SIZE + 6

// ── Synchronous write helpers (bypass libuv I/O queue) ────
const dbg = (s) => fs.writeSync(process.stderr.fd, s + '\n')
const out = (s) => fs.writeSync(process.stdout.fd, s + '\n')

// ── koffi DLL loading ──────────────────────────────────────
const user32   = koffi.load('user32.dll')
const kernel32 = koffi.load('kernel32.dll')

// ── WndProc proto (before WNDCLASSW) ──────────────────────
const WndProcProto = koffi.proto(
  'intptr_t __stdcall WndProcProto(void *hwnd, uint32_t msg, uint64_t wParam, void *lParam)'
)

// ── Struct definitions ─────────────────────────────────────
const POINT = koffi.struct('POINT', { x: 'int32_t', y: 'int32_t' })

// MSG without lPrivate (Mac-only field) — total 48 bytes on 64-bit
const MSG = koffi.struct('MSG', {
  hwnd:    'void *',
  message: 'uint32_t',
  wParam:  'uint64_t',
  lParam:  'int64_t',
  time:    'uint32_t',
  pt:      POINT
})

const RAWINPUTDEVICE = koffi.struct('RAWINPUTDEVICE', {
  usUsagePage: 'uint16_t',
  usUsage:     'uint16_t',
  dwFlags:     'uint32_t',
  hwndTarget:  'void *'
})

const WNDCLASSW = koffi.struct('WNDCLASSW', {
  style:         'uint32_t',
  lpfnWndProc:   koffi.pointer(WndProcProto),
  cbClsExtra:    'int32_t',
  cbWndExtra:    'int32_t',
  hInstance:     'void *',
  hIcon:         'void *',
  hCursor:       'void *',
  hbrBackground: 'void *',
  lpszMenuName:  'void *',
  lpszClassName: 'void *'
})

// ── Win32 function declarations ────────────────────────────
const GetModuleHandleW = kernel32.func('GetModuleHandleW', 'void *', ['void *'])
const RegisterClassW   = user32.func('RegisterClassW', 'uint16_t', ['WNDCLASSW *'])
const CreateWindowExW  = user32.func('CreateWindowExW', 'void *', [
  'uint32_t', 'void *', 'void *', 'uint32_t',
  'int32_t', 'int32_t', 'int32_t', 'int32_t',
  'void *', 'void *', 'void *', 'void *'
])
const RegisterRawInputDevices = user32.func('RegisterRawInputDevices', 'int32_t', [
  'RAWINPUTDEVICE *', 'uint32_t', 'uint32_t'
])
const GetRawInputData = user32.func('GetRawInputData', 'uint32_t', [
  'void *',    // hRawInput
  'uint32_t',  // uiCommand
  'void *',    // pData
  'uint32_t *', // pcbSize (inout — pass as [n] array)
  'uint32_t'   // cbSizeHeader
])
const PeekMessageW     = user32.func('PeekMessageW',     'int32_t',  ['MSG *', 'void *', 'uint32_t', 'uint32_t', 'uint32_t'])
const TranslateMessage = user32.func('TranslateMessage', 'int32_t',  ['MSG *'])
const DispatchMessageW = user32.func('DispatchMessageW', 'intptr_t', ['MSG *'])
const DefWindowProcW   = user32.func('DefWindowProcW',   'intptr_t', ['void *', 'uint32_t', 'uint64_t', 'void *'])
const PostQuitMessage  = user32.func('PostQuitMessage',  'void',     ['int32_t'])

// ── Barcode buffer logic ───────────────────────────────────
let buffer = ''
let lastKeyTime = 0

function vkToChar(vk) {
  if (vk >= VK_0 && vk <= VK_9) return String.fromCharCode(vk)
  if (vk >= VK_A && vk <= VK_Z) return String.fromCharCode(vk)
  if (vk >= VK_NUMPAD0 && vk <= VK_NUMPAD9) return String.fromCharCode(0x30 + (vk - VK_NUMPAD0))
  if (vk === VK_DECIMAL || vk === VK_OEM_PERIOD) return '.'
  return null
}

function handleVKey(vk, flags) {
  if (flags & RI_KEY_BREAK) return

  const now = Date.now()
  if (now - lastKeyTime > SCAN_THRESHOLD_MS && buffer.length > 0) buffer = ''
  lastKeyTime = now

  if (vk === VK_RETURN) {
    if (buffer.length >= MIN_BARCODE_LENGTH) {
      const code = buffer
      buffer = ''
      dbg(`✅ Barcode: "${code}"`)
      out(code)
    } else {
      buffer = ''
    }
    return
  }

  const ch = vkToChar(vk)
  if (ch) buffer += ch
}

// ── WndProc callback ───────────────────────────────────────
const rawBuf = Buffer.alloc(128)

const wndProc = koffi.register(function (hwnd, msg, wParam, lParam) {
  if (msg === WM_INPUT) {
    const sizeRef = [rawBuf.length]
    const read = GetRawInputData(lParam, RID_INPUT, rawBuf, sizeRef, HDR_SIZE)
    if (read > 0 && read !== 0xFFFFFFFF) {
      const dwType = rawBuf.readUInt32LE(0)
      if (dwType === RIM_TYPEKEYBOARD) {
        const flags = rawBuf.readUInt16LE(FLAGS_OFF)
        const vk    = rawBuf.readUInt16LE(VKEY_OFF)
        dbg(`[key] vk=0x${vk.toString(16)} flags=${flags}`)
        handleVKey(vk, flags)
      }
    }
    return 0
  }
  if (msg === WM_DESTROY) {
    PostQuitMessage(0)
    return 0
  }
  return DefWindowProcW(hwnd, msg, wParam, lParam)
}, koffi.pointer(WndProcProto))

// ── Bootstrap ──────────────────────────────────────────────
dbg('📡 Scanner worker (Raw Input) starting...')

const hInstance = GetModuleHandleW(null)
const classBuf  = Buffer.from('SEMedScannerInputSink\0', 'utf16le')
const titleBuf  = Buffer.from('SEMedScanner\0', 'utf16le')

const wc = {
  style: 0, lpfnWndProc: wndProc,
  cbClsExtra: 0, cbWndExtra: 0, hInstance,
  hIcon: null, hCursor: null, hbrBackground: null,
  lpszMenuName: null, lpszClassName: classBuf
}

const atom = RegisterClassW(wc)
if (!atom) {
  dbg('❌ RegisterClassW failed')
  process.exit(1)
}

const hwnd = CreateWindowExW(
  0, classBuf, titleBuf, 0,
  0, 0, 0, 0,
  null, null, hInstance, null
)

if (!hwnd) {
  dbg('❌ CreateWindowExW failed')
  process.exit(1)
}

const rid = {
  usUsagePage: 0x01,
  usUsage:     0x06,
  dwFlags:     RIDEV_INPUTSINK,
  hwndTarget:  hwnd
}

const ok = RegisterRawInputDevices(rid, 1, koffi.sizeof(RAWINPUTDEVICE))
if (!ok) {
  dbg('❌ RegisterRawInputDevices failed')
  process.exit(1)
}

dbg('📡 Scanner worker started — Raw Input INPUTSINK active')

// ── PeekMessage polling (10ms) — keeps Node.js event loop alive ──
const msg = {}
setInterval(() => {
  while (PeekMessageW(msg, null, 0, 0, PM_REMOVE) > 0) {
    TranslateMessage(msg)
    DispatchMessageW(msg)
  }
}, 10)

// Kill worker if parent dies
process.on('disconnect', () => process.exit(0))

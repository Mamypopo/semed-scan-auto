'use strict'
// WH_KEYBOARD_LL via koffi — runs directly in Electron main process
// Electron's Win32 message loop pumps the hook automatically (no worker needed)

const koffi = require('koffi')

const SCAN_THRESHOLD_MS  = parseInt(process.env.SCAN_THRESHOLD_MS) || 50
const MIN_BARCODE_LENGTH = 5

// ── Win32 constants ────────────────────────────────────────
const WH_KEYBOARD_LL = 13
const WM_KEYDOWN     = 0x0100
const WM_KEYUP       = 0x0101
const WM_SYSKEYDOWN  = 0x0104
const WM_SYSKEYUP    = 0x0105

// Virtual key codes
const VK_RETURN     = 0x0D
const VK_MENU       = 0x12   // Alt (generic)
const VK_LMENU      = 0xA4   // Left Alt
const VK_RMENU      = 0xA5   // Right Alt
const VK_A = 0x41,  VK_Z = 0x5A
const VK_0 = 0x30,  VK_9 = 0x39
const VK_NUMPAD0 = 0x60, VK_NUMPAD9 = 0x69
const VK_DECIMAL    = 0x6E
const VK_OEM_PERIOD = 0xBE

// ── koffi setup ────────────────────────────────────────────
const user32   = koffi.load('user32.dll')
const kernel32 = koffi.load('kernel32.dll')

const KBDLLHOOKSTRUCT = koffi.struct('KBDLLHOOKSTRUCT', {
  vkCode:      'uint32_t',
  scanCode:    'uint32_t',
  flags:       'uint32_t',
  time:        'uint32_t',
  dwExtraInfo: 'uint64_t'
})

const HookProto = koffi.proto(
  'intptr_t __stdcall HookProto(int32_t nCode, uint64_t wParam, void *lParam)'
)

const SetWindowsHookExW   = user32.func('SetWindowsHookExW',   'void *',   ['int32_t', koffi.pointer(HookProto), 'void *', 'uint32_t'])
const CallNextHookEx      = user32.func('CallNextHookEx',      'intptr_t', ['void *', 'int32_t', 'uint64_t', 'void *'])
const UnhookWindowsHookEx = user32.func('UnhookWindowsHookEx', 'int32_t',  ['void *'])
const GetModuleHandleW    = kernel32.func('GetModuleHandleW',  'void *',   ['void *'])

// ── Barcode logic ──────────────────────────────────────────
function vkToChar(vk) {
  if (vk >= VK_0 && vk <= VK_9) return String.fromCharCode(vk)
  if (vk >= VK_A && vk <= VK_Z) return String.fromCharCode(vk)
  if (vk >= VK_NUMPAD0 && vk <= VK_NUMPAD9) return String.fromCharCode(0x30 + (vk - VK_NUMPAD0))
  if (vk === VK_DECIMAL || vk === VK_OEM_PERIOD) return '.'
  return null
}

let buffer     = ''
let lastKeyTime = 0
let altHeld    = false   // Alt+NumPad mode tracking
let altBuf     = ''      // collects numpad digits while Alt is held
let hhook  = null
let hookCb = null  // keep reference to prevent GC

function initScanner(onScan) {
  const hInstance = GetModuleHandleW(null)

  hookCb = koffi.register(function (nCode, wParam, lParam) {
    try {
      if (nCode >= 0) {
        const kbd = koffi.decode(lParam, KBDLLHOOKSTRUCT)
        const vk  = kbd.vkCode
        const isDown = (wParam === WM_KEYDOWN || wParam === WM_SYSKEYDOWN)
        const isUp   = (wParam === WM_KEYUP   || wParam === WM_SYSKEYUP)

        // ── Alt+NumPad mode handling ──────────────────────
        // Some scanners send Alt+<decimal-ASCII-code> per char
        // e.g. to send '6' (ASCII 54): Alt down → NumPad0, NumPad5, NumPad4 → Alt up
        if (vk === VK_LMENU || vk === VK_RMENU || vk === VK_MENU) {
          if (isDown) {
            altHeld = true
            altBuf  = ''
            // update timestamp on alt-DOWN so the gap check uses within-character time
            lastKeyTime = Date.now()
          } else if (isUp && altHeld) {
            if (altBuf.length > 0) {
              const code = parseInt(altBuf, 10)
              if (code >= 32 && code < 127) {
                const ch = String.fromCharCode(code)
                // Alt+NumPad: use 2000ms threshold (much looser — scanner sends all chars in a burst)
                const now = Date.now()
                if (now - lastKeyTime > 2000 && buffer.length > 0) buffer = ''
                lastKeyTime = now
                buffer += ch
                console.log(`[alt+num] code=${code} char="${ch}" buf="${buffer}"`)
              }
            }
            altHeld = false
            altBuf  = ''
          }
          return CallNextHookEx(hhook, nCode, wParam, lParam)
        }

        // Collect numpad digits while Alt is held (Alt+NumPad sequence)
        if (altHeld && isDown && vk >= VK_NUMPAD0 && vk <= VK_NUMPAD9) {
          altBuf += String(vk - VK_NUMPAD0)
          return CallNextHookEx(hhook, nCode, wParam, lParam)
        }

        // ── Normal key processing ─────────────────────────
        if (isDown) {
          const now = Date.now()
          if (now - lastKeyTime > SCAN_THRESHOLD_MS && buffer.length > 0) buffer = ''
          lastKeyTime = now

          if (vk === VK_RETURN) {
            if (buffer.length >= MIN_BARCODE_LENGTH) {
              const code = buffer
              buffer = ''
              console.log(`📥 Barcode captured: "${code}"`)
              if (typeof onScan === 'function') onScan(code)
            } else {
              buffer = ''
            }
          } else {
            const ch = vkToChar(vk)
            if (ch) {
              buffer += ch
              console.log(`[key] vk=0x${vk.toString(16)} char="${ch}" buf="${buffer}"`)
            }
          }
        }
      }
    } catch (e) {
      console.error('❌ Hook callback error:', e.message)
    }
    return CallNextHookEx(hhook, nCode, wParam, lParam)
  }, koffi.pointer(HookProto))

  hhook = SetWindowsHookExW(WH_KEYBOARD_LL, hookCb, hInstance, 0)

  if (!hhook) {
    console.error('❌ SetWindowsHookExW failed — keyboard capture disabled')
    return
  }

  console.log('📡 WH_KEYBOARD_LL hook installed — global keyboard capture active')
}

function stopScanner() {
  if (hhook) {
    UnhookWindowsHookEx(hhook)
    hhook = null
  }
  if (hookCb) {
    koffi.unregister(hookCb)
    hookCb = null
  }
  console.log('🛑 Keyboard hook removed')
}

module.exports = { initScanner, stopScanner }

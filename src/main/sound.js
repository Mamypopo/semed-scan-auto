'use strict'

const path = require('path')

const SND_FILENAME  = 0x20000
const SND_ASYNC     = 0x0001
const SND_NODEFAULT = 0x0002

const SOUNDS_DIR = path.join(__dirname, '../../assets/sounds')

const SOUND_FILES = {
  success:   '1-correct-2-46134.wav',
  error:     '2-wronganswer-37702.wav',
  duplicate: '3-duplicate.wav'
}

// Lazy-load koffi เพื่อไม่ให้ conflict กับ koffi instance ของ scanner.js ตอน startup
let PlaySoundW = null
function getPlaySound() {
  if (PlaySoundW) return PlaySoundW
  try {
    const koffi = require('koffi')
    const winmm = koffi.load('winmm.dll')
    PlaySoundW = winmm.func('PlaySoundW', 'int32_t', ['str16', 'void *', 'uint32_t'])
  } catch (e) {
    console.warn('⚠️ PlaySoundW load failed:', e.message)
    PlaySoundW = () => {}
  }
  return PlaySoundW
}

function playSound(name) {
  const filename = SOUND_FILES[name]
  if (!filename) return
  const file = path.join(SOUNDS_DIR, filename)
  try {
    getPlaySound()(file, null, SND_FILENAME | SND_ASYNC | SND_NODEFAULT)
  } catch (e) {
    // ไม่ crash ถ้าไม่มีไฟล์หรือ PlaySound ล้มเหลว
  }
}

module.exports = { playSound }

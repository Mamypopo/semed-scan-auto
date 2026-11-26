// ข้อความแจ้งผู้ใช้เมื่อ POST /scan/recheck ไม่สำเร็จ
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { recheckErrorMessage } = require('../src/main/recheck-message')

const http400 = (data) => ({ response: { status: 400, data } })

test('ยังไม่มีการยิงจากหน้างาน (ยังไม่ได้รับ) — บอกให้ไปกด "รับไว้ และแจ้งทะเบียน" ที่เว็บ', () => {
  const msg = recheckErrorMessage(http400({
    success: false,
    canRequestRegistrationScan: true,
    alreadyReceived: false,
    message: 'ยังไม่มีการยิงจากหน้างานสำหรับ "CBC"'
  }))
  assert.equal(msg, 'ยังไม่มีการยิงจากหน้างานสำหรับ "CBC" — ไปกด "รับไว้ และแจ้งทะเบียน" ที่หน้าเว็บ Lab Recheck')
})

test('รับไว้แล้วแต่รายการหน้างานหายไป — บอกให้ไปกด "แจ้งทะเบียน" ที่เว็บ (ไม่ต้องรับซ้ำ)', () => {
  const msg = recheckErrorMessage(http400({
    success: false,
    canRequestRegistrationScan: true,
    alreadyReceived: true,
    message: 'ยังไม่มีการยิงจากหน้างานสำหรับ "CBC"'
  }))
  assert.equal(msg, 'ยังไม่มีการยิงจากหน้างานสำหรับ "CBC" — รับไว้แล้ว ไปกด "แจ้งทะเบียน" ที่หน้าเว็บ Lab Recheck')
})

test('error 400 อื่น — ใช้ข้อความจาก server ตามเดิม', () => {
  const msg = recheckErrorMessage(http400({ success: false, message: '"X-Ray" ไม่ใช่จุดตรวจ LAB' }))
  assert.equal(msg, '"X-Ray" ไม่ใช่จุดตรวจ LAB')
})

test('timeout — บอกว่าลองซ้ำแล้ว และรายการอาจบันทึกแล้ว', () => {
  const msg = recheckErrorMessage({ code: 'ECONNABORTED', message: 'timeout of 10000ms exceeded' })
  assert.equal(msg, 'server ตอบช้าเกินไป (ลองซ้ำแล้ว) รายการนี้อาจบันทึกแล้ว กรุณายิงซ้ำเพื่อตรวจสอบ')
})

test('ไม่มี response (เช่น เครือข่ายหลุด) — ใช้ error.message', () => {
  assert.equal(recheckErrorMessage({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' }), 'connect ECONNREFUSED')
})

// เทส logic ยิงซ้ำเมื่อ POST /scan/recheck timeout — ใช้ axios จริงกับ HTTP server จริงในเครื่อง
// รัน: npm test  (node --test)
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const axios = require('axios')
const { recheckWithRetry, isTimeoutError } = require('../src/main/recheck-retry')

// server ปลอมของ /scan/recheck — แต่ละ test ตั้งพฤติกรรมเองผ่าน `behave`
let server
let baseURL
let hits
let behave

before(async () => {
  server = http.createServer((req, res) => {
    hits++
    behave(hits, res)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  baseURL = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  server.closeAllConnections()
  server.close()
})

function setup(fn) {
  hits = 0
  behave = fn
}

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}
const hang = () => {} // ไม่ตอบ → client timeout

// เหมือน recheckCheckpoint() แต่ timeout สั้นเพื่อให้เทสเร็ว
const callRecheck = () =>
  axios.post(`${baseURL}/scan/recheck`, { barcode: 'CN001.5', cnGroupId: 'G1' }, { timeout: 200 }).then((r) => r.data)

test('ตอบปกติ — ยิงครั้งเดียว ไม่ยิงซ้ำ', async () => {
  setup((n, res) => json(res, 200, { success: true, isNewRecheck: true }))
  const result = await recheckWithRetry(callRecheck)
  assert.equal(result.isNewRecheck, true)
  assert.equal(hits, 1)
})

test('ครั้งแรก timeout (server บันทึกแล้ว) — ยิงซ้ำ 1 ครั้งแล้วได้ "recheck แล้ว"', async () => {
  setup((n, res) => (n === 1 ? hang() : json(res, 200, { success: true, isNewRecheck: false, message: 'recheck แล้ว เมื่อ 10:42' })))
  let retried = 0
  const result = await recheckWithRetry(callRecheck, { onRetry: () => retried++ })
  assert.equal(result.isNewRecheck, false)
  assert.equal(result.message, 'recheck แล้ว เมื่อ 10:42')
  assert.equal(hits, 2)
  assert.equal(retried, 1)
})

test('timeout ทั้ง 2 ครั้ง — ยิงแค่ 2 ครั้ง แล้วโยน timeout error ออกมา', async () => {
  setup(hang)
  await assert.rejects(recheckWithRetry(callRecheck), (err) => isTimeoutError(err))
  assert.equal(hits, 2)
})

test('server ตอบ 400 (เช่น ไม่พบการยิงจากหน้างาน) — ไม่ยิงซ้ำ', async () => {
  setup((n, res) => json(res, 400, { success: false, message: 'ไม่พบการยิงจากหน้างาน' }))
  await assert.rejects(recheckWithRetry(callRecheck), (err) => {
    assert.equal(isTimeoutError(err), false)
    assert.equal(err.response.data.message, 'ไม่พบการยิงจากหน้างาน')
    return true
  })
  assert.equal(hits, 1)
})

test('server ตอบ 500 — ไม่ยิงซ้ำ (ไม่ใช่ timeout)', async () => {
  setup((n, res) => json(res, 500, { message: 'error' }))
  await assert.rejects(recheckWithRetry(callRecheck))
  assert.equal(hits, 1)
})

test('isTimeoutError — แยก timeout ออกจาก error อื่น', () => {
  assert.equal(isTimeoutError({ code: 'ECONNABORTED' }), true)
  assert.equal(isTimeoutError({ code: 'ETIMEDOUT' }), true)
  assert.equal(isTimeoutError({ code: 'ECONNREFUSED' }), false)
  assert.equal(isTimeoutError({ code: 'ECONNABORTED', response: { status: 408 } }), false)
  assert.equal(isTimeoutError(null), false)
})

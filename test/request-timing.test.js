// เทสการจับเวลา request — log เฉพาะตอนช้าเกิน threshold หรือ timeout (request ปกติไม่ log)
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const axios = require('axios')
const { attachTiming } = require('../src/main/request-timing')

let server
let baseURL

before(async () => {
  // /fast ตอบทันที, /slow ตอบหลัง 150ms, /hang ไม่ตอบ, /fail ตอบ 400 ช้า
  server = http.createServer((req, res) => {
    const send = (status) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end('{}') }
    if (req.url.startsWith('/fast')) return send(200)
    if (req.url.startsWith('/slow')) return setTimeout(() => send(200), 150)
    if (req.url.startsWith('/fail')) return setTimeout(() => send(400), 150)
    // /hang: ไม่ตอบ
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  baseURL = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  server.closeAllConnections()
  server.close()
})

function makeClient(thresholdMs = 100) {
  const slow = []
  const api = axios.create({ baseURL, timeout: 300 })
  attachTiming(api, { thresholdMs, onSlow: (info) => slow.push(info) })
  return { api, slow }
}

test('request เร็ว — ไม่ log', async () => {
  const { api, slow } = makeClient()
  await api.get('/fast')
  assert.equal(slow.length, 0)
})

test('request ช้าเกิน threshold — log method, path, เวลา และ status', async () => {
  const { api, slow } = makeClient()
  await api.post('/slow/scan/recheck', { barcode: 'CN001.5' })
  assert.equal(slow.length, 1)
  assert.equal(slow[0].method, 'POST')
  assert.equal(slow[0].url, '/slow/scan/recheck')
  assert.equal(slow[0].status, 200)
  assert.equal(slow[0].timedOut, false)
  assert.ok(slow[0].ms >= 140, `ms=${slow[0].ms}`)
})

test('timeout — log ว่า timedOut พร้อมเวลาที่รอไป', async () => {
  const { api, slow } = makeClient()
  await assert.rejects(api.get('/hang'))
  assert.equal(slow.length, 1)
  assert.equal(slow[0].timedOut, true)
  assert.equal(slow[0].status, null)
  assert.ok(slow[0].ms >= 290, `ms=${slow[0].ms}`)
})

test('error ที่ช้าเกิน threshold — log status ของ error และยังโยน error เดิมออกไป', async () => {
  const { api, slow } = makeClient()
  await assert.rejects(api.get('/fail'), (err) => err.response?.status === 400)
  assert.equal(slow.length, 1)
  assert.equal(slow[0].status, 400)
})

test('ไม่ log url ที่มี query string (กันข้อมูลหลุด) — ตัด query ออก', async () => {
  const { api, slow } = makeClient()
  await api.get('/slow/scan/recheck/summary?cnGroupId=G1')
  assert.equal(slow[0].url, '/slow/scan/recheck/summary')
})

test('onSlow พัง — ไม่ทำให้ request พัง', async () => {
  const api = axios.create({ baseURL, timeout: 300 })
  attachTiming(api, { thresholdMs: 100, onSlow: () => { throw new Error('boom') } })
  const res = await api.get('/slow')
  assert.equal(res.status, 200)
})

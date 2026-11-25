// จับเวลา request ของ axios — เรียก onSlow เฉพาะตอนช้าเกิน threshold หรือ timeout
// (request ปกติไม่ log เพื่อไม่ให้ log ล้น) ไม่แตะ request/response และไม่ยิง API เพิ่ม

function pathOnly(url) {
  return String(url || '').split('?')[0] // ตัด query string ออก ไม่ให้ค่า parameter ไปอยู่ใน log
}

/**
 * @param {import('axios').AxiosInstance} api
 * @param {{ thresholdMs: number, onSlow: (info: { method: string, url: string, ms: number, status: number|null, timedOut: boolean }) => void }} opts
 */
function attachTiming(api, { thresholdMs, onSlow }) {
  const report = (config, status, timedOut) => {
    const startedAt = config?.__startedAt
    if (!startedAt) return
    const ms = Date.now() - startedAt
    if (!timedOut && ms < thresholdMs) return
    try {
      onSlow({ method: String(config.method || 'get').toUpperCase(), url: pathOnly(config.url), ms, status, timedOut })
    } catch {
      // log พังต้องไม่ทำให้ request พัง
    }
  }

  api.interceptors.request.use((config) => {
    config.__startedAt = Date.now()
    return config
  })

  api.interceptors.response.use(
    (response) => {
      report(response.config, response.status, false)
      return response
    },
    (error) => {
      const timedOut = !error.response && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
      report(error.config, error.response?.status ?? null, timedOut)
      return Promise.reject(error)
    }
  )
}

module.exports = { attachTiming }

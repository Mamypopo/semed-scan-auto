// ยิง POST /scan/recheck ซ้ำอัตโนมัติ 1 ครั้งเมื่อ timeout
//
// timeout ไม่ได้แปลว่าไม่บันทึก — server อาจบันทึกไปแล้วแต่ตอบช้า การยิงซ้ำปลอดภัย เพราะ
// server ตอบ { success: true, isNewRecheck: false, message: 'recheck แล้ว …' } ไม่นับยอดซ้ำ
// error อื่น (4xx/5xx/เครือข่าย) ไม่ยิงซ้ำ

function isTimeoutError(error) {
  return !error?.response && (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT')
}

/**
 * @param {() => Promise<any>} call - ฟังก์ชันยิง API (เช่น () => recheckCheckpoint(barcode, cnGroupId))
 * @param {{ onRetry?: (error) => void }} [opts]
 */
async function recheckWithRetry(call, { onRetry } = {}) {
  try {
    return await call()
  } catch (error) {
    if (!isTimeoutError(error)) throw error
    if (onRetry) onRetry(error)
    return await call()
  }
}

module.exports = { recheckWithRetry, isTimeoutError }

// ข้อความแจ้งผู้ใช้เมื่อ POST /scan/recheck ไม่สำเร็จ
const { isTimeoutError } = require('./recheck-retry')

const WEB_PAGE = 'หน้าเว็บ Lab Recheck'

function recheckErrorMessage(error) {
  if (isTimeoutError(error)) {
    return 'server ตอบช้าเกินไป (ลองซ้ำแล้ว) รายการนี้อาจบันทึกแล้ว กรุณายิงซ้ำเพื่อตรวจสอบ'
  }

  const data = error?.response?.data
  const message = data?.message || error?.message

  // มีใบสั่งตรวจ แต่หน้างานยังไม่ได้ยิง — scanner ไม่รับให้เอง (ต้องมีคนกดยืนยันทุกครั้ง
  // กันยิงผิดใบแล้วกลายเป็นรับของที่ไม่มีจริง) ให้ไปทำต่อที่หน้าเว็บ
  if (data?.canRequestRegistrationScan) {
    return data.alreadyReceived
      ? `${message} — รับไว้แล้ว ไปกด "แจ้งทะเบียน" ที่${WEB_PAGE}`
      : `${message} — ไปกด "รับไว้ และแจ้งทะเบียน" ที่${WEB_PAGE}`
  }

  return message
}

module.exports = { recheckErrorMessage }

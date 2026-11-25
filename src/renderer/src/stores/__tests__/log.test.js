import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLogStore } from '../log'

describe('log store', () => {
  let log

  beforeEach(() => {
    setActivePinia(createPinia())
    log = useLogStore()
  })

  it('เก็บไว้ไม่เกิน 500 รายการ', () => {
    for (let i = 0; i < 600; i++) log.add('info', `msg ${i}`)
    expect(log.entries).toHaveLength(500)
  })

  it('เก็บรายการล่าสุดไว้ ลบรายการเก่าที่สุดทิ้ง', () => {
    for (let i = 0; i < 600; i++) log.add('info', `msg ${i}`)
    expect(log.entries[0].message).toBe('msg 599')
    expect(log.entries[499].message).toBe('msg 100')
  })

  it('ไม่ถึง 500 ไม่ลบอะไร', () => {
    for (let i = 0; i < 3; i++) log.add('info', `msg ${i}`)
    expect(log.entries).toHaveLength(3)
  })
})

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// เก็บแค่รายการล่าสุด กันหน่วยความจำโตเรื่อยๆ ตอนเปิดแอปทิ้งไว้ทั้งวัน
const MAX_ENTRIES = 500

export const useLogStore = defineStore('log', () => {
  const entries = ref([])

  const errorCount = computed(() => entries.value.filter(e => e.level === 'error').length)

  function add(level, message, detail = null) {
    entries.value.unshift({
      id: Date.now() + Math.random(),
      level,
      message,
      detail: detail != null
        ? (typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2))
        : null,
      time: new Date()
    })
    if (entries.value.length > MAX_ENTRIES) entries.value.length = MAX_ENTRIES
  }

  function clear() { entries.value = [] }

  return { entries, errorCount, add, clear }
})

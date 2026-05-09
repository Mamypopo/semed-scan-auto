import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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
  }

  function clear() { entries.value = [] }

  return { entries, errorCount, add, clear }
})

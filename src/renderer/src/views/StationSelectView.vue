<template>
  <div class="max-w-2xl mx-auto">
    <div class="text-center mb-8">
      <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-secondary-100 to-secondary-200 flex items-center justify-center text-2xl">
        🏥
      </div>
      <h2 class="text-xl font-bold text-zinc-900 mb-1">เลือกจุดตรวจ</h2>
      <p class="text-sm text-zinc-500">เลือกจุดตรวจที่คุณปฏิบัติงาน</p>
    </div>

    <!-- User Card -->
    <div class="card-minimal mb-6 flex items-center gap-4">
      <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-xl">
        👤
      </div>
      <div>
        <p class="font-semibold text-zinc-900">{{ authStore.user?.name || authStore.user?.email }}</p>
        <p class="text-sm text-zinc-500">{{ authStore.user?.role || 'ผู้ใช้งาน' }}</p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="text-center py-12">
      <div class="w-10 h-10 mx-auto border-3 border-zinc-200 border-t-primary-500 rounded-full animate-spin"></div>
      <p class="mt-3 text-sm text-zinc-500">กำลังโหลดรายการ...</p>
    </div>

    <!-- Station List -->
    <div v-else class="space-y-3">
      <button
        v-for="station in stations"
        :key="station.id"
        @click="selectStation(station)"
        class="w-full text-left card-minimal p-4 hover:border-primary-300 hover:shadow-pearl-lg transition-all duration-200 group"
      >
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center text-xl group-hover:from-primary-100 group-hover:to-primary-200 transition-all">
            🏥
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h3 class="font-medium text-zinc-900">{{ station.name }}</h3>
              <span v-if="station.isSpecial" class="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-100 text-accent-700">
                {{ station.specialType || 'พิเศษ' }}
              </span>
            </div>
            <p v-if="station.stationGroup" class="text-sm text-zinc-500 mt-0.5">{{ station.stationGroup }}</p>
          </div>
          <svg class="w-5 h-5 text-zinc-300 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="!isLoading && stations.length === 0" class="text-center py-12">
      <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-100 flex items-center justify-center text-2xl">
        📭
      </div>
      <p class="text-zinc-500">ไม่พบจุดตรวจ</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const stations = ref([])
const isLoading = ref(true)

async function loadStations() {
  isLoading.value = true
  try {
    const result = await window.api.getStations()
    if (result.success) {
      stations.value = result.data
    }
  } catch (error) {
    console.error('Failed to load stations:', error)
  } finally {
    isLoading.value = false
  }
}

async function selectStation(station) {
  await authStore.selectStation(station)
}

onMounted(loadStations)
</script>

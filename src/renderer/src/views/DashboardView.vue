<template>
  <div class="max-w-md mx-auto">
    <!-- Header Card -->
    <div class="card-minimal mb-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-lg">
            👤
          </div>
          <div>
            <p class="font-semibold text-zinc-900 text-sm">{{ authStore.user?.name || authStore.user?.email }}</p>
            <p class="text-xs text-zinc-500">{{ authStore.user?.role || 'ผู้ใช้งาน' }}</p>
          </div>
        </div>
        <button 
          @click="showStationSelect = !showStationSelect"
          class="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors"
        >
          {{ showStationSelect ? 'ยกเลิก' : 'เปลี่ยนจุดตรวจ' }}
        </button>
      </div>
    </div>

    <!-- Station Selector (Collapsible) -->
    <div v-if="showStationSelect" class="card-minimal mb-4 animate-fade-in">
      <h3 class="text-sm font-semibold text-zinc-700 mb-3">เลือกจุดตรวจ</h3>
      
      <div v-if="isLoadingStations" class="text-center py-4">
        <div class="w-8 h-8 mx-auto border-2 border-zinc-200 border-t-primary-500 rounded-full animate-spin"></div>
      </div>

      <div v-else class="space-y-2 max-h-60 overflow-y-auto">
        <button
          v-for="station in stations"
          :key="station.id"
          @click="selectStation(station)"
          :class="[
            'w-full text-left p-3 rounded-xl border transition-all',
            authStore.selectedStation?.id === station.id
              ? 'border-primary-500 bg-primary-50'
              : 'border-zinc-200 hover:border-primary-300 hover:bg-zinc-50'
          ]"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-sm">
              🏥
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm truncate">{{ station.name }}</p>
              <p v-if="station.stationGroup" class="text-xs text-zinc-500">{{ station.stationGroup }}</p>
            </div>
            <span v-if="station.isSpecial" class="px-2 py-0.5 rounded-full text-[10px] bg-accent-100 text-accent-700">
              พิเศษ
            </span>
          </div>
        </button>
      </div>
    </div>

    <!-- Current Station Badge -->
    <div v-else-if="authStore.selectedStation" class="flex items-center gap-2 mb-4 px-1">
      <span class="text-sm text-zinc-500">จุดตรวจ:</span>
      <span class="px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-sm font-medium">
        {{ authStore.selectedStation.name }}
      </span>
    </div>

    <!-- Mode Selector -->
    <div class="card-minimal mb-4">
      <h3 class="text-sm font-semibold text-zinc-700 mb-3">โหมดการสแกน</h3>
      <div class="grid grid-cols-2 gap-3">
        <button
          @click="scannerStore.setScanMode('checkup')"
          :class="[
            'p-4 rounded-xl border-2 transition-all text-center',
            scannerStore.scanMode === 'checkup'
              ? 'border-primary-500 bg-primary-50'
              : 'border-zinc-200 hover:border-primary-300'
          ]"
        >
          <div class="text-2xl mb-1">🏢</div>
          <div class="font-medium text-sm">Checkup</div>
          <div class="text-xs text-zinc-500">ตรวจสุขภาพ</div>
        </button>
        <button
          @click="scannerStore.setScanMode('clinic')"
          :class="[
            'p-4 rounded-xl border-2 transition-all text-center',
            scannerStore.scanMode === 'clinic'
              ? 'border-primary-500 bg-primary-50'
              : 'border-zinc-200 hover:border-primary-300'
          ]"
        >
          <div class="text-2xl mb-1">🏥</div>
          <div class="font-medium text-sm">Clinic</div>
          <div class="text-xs text-zinc-500">คลินิก</div>
        </button>
      </div>
    </div>

    <!-- Scanner Status -->
    <div class="card-minimal text-center mb-4 relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-primary-50/50 via-transparent to-primary-50/50"></div>
      
      <div class="relative">
        <div class="w-20 h-20 mx-auto mb-4 relative">
          <div class="absolute inset-0 rounded-full bg-gradient-to-r from-primary-200 via-accent-200 to-primary-200 blur-xl opacity-60 animate-pulse"></div>
          <div class="relative w-full h-full rounded-full bg-white border border-zinc-200 flex items-center justify-center">
            <div class="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-2xl shadow-lg">
              📡
            </div>
          </div>
        </div>

        <h2 class="text-base font-bold text-zinc-900 mb-1">พร้อมรับการสแกน</h2>
        <p class="text-xs text-zinc-500 mb-3">สแกนบาร์โค้ดผู้ป่วยได้เลย</p>

        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100">
          <span class="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
          <span class="text-xs font-medium text-zinc-600">{{ scannerStore.scanMode === 'checkup' ? 'Checkup' : 'Clinic' }} Mode</span>
        </div>
      </div>
    </div>

    <!-- Last Result -->
    <div class="card-minimal mb-4">
      <h3 class="text-sm font-semibold text-zinc-700 mb-3">ผลล่าสุด</h3>
      
      <div v-if="!scannerStore.lastScan" class="text-center py-6 text-zinc-400">
        <div class="text-3xl mb-2">📋</div>
        <p class="text-xs">ยังไม่มีการสแกน</p>
      </div>

      <div v-else :class="[
        'p-3 rounded-xl border-l-4',
        scannerStore.lastScan.success 
          ? 'bg-green-50 border-green-500' 
          : 'bg-red-50 border-red-500'
      ]">
        <div class="flex items-center gap-2">
          <span class="text-lg">{{ scannerStore.lastScan.success ? '✅' : '❌' }}</span>
          <div class="flex-1">
            <p class="font-medium text-sm" :class="scannerStore.lastScan.success ? 'text-zinc-900' : 'text-red-700'">
              {{ scannerStore.lastScan.patientName || scannerStore.lastScan.error }}
            </p>
            <p class="text-[10px] text-zinc-500">{{ formatTime(scannerStore.lastScan.timestamp) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- History -->
    <div class="card-minimal">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-zinc-700">ประวัติ ({{ scannerStore.scanHistory.length }})</h3>
        <button 
          v-if="scannerStore.scanHistory.length > 0"
          @click="scannerStore.clearHistory"
          class="text-xs text-zinc-400 hover:text-zinc-600"
        >
          ล้าง
        </button>
      </div>

      <div v-if="scannerStore.scanHistory.length === 0" class="text-center py-4 text-zinc-400 text-xs">
        ไม่มีประวัติ
      </div>

      <div v-else class="space-y-2 max-h-40 overflow-y-auto">
        <div
          v-for="(scan, index) in scannerStore.recentScans"
          :key="index"
          :class="[
            'flex items-center gap-2 p-2 rounded-lg text-xs',
            scan.success ? 'bg-zinc-50' : 'bg-red-50/50'
          ]"
        >
          <span>{{ scan.success ? '✅' : '❌' }}</span>
          <span class="flex-1 truncate" :class="scan.success ? 'text-zinc-900' : 'text-red-700'">
            {{ scan.patientName || scan.error }}
          </span>
          <span class="text-zinc-400 text-[10px]">{{ formatTime(scan.timestamp, true) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useScannerStore } from '../stores/scanner'

const authStore = useAuthStore()
const scannerStore = useScannerStore()

const showStationSelect = ref(false)
const stations = ref([])
const isLoadingStations = ref(false)

async function loadStations() {
  isLoadingStations.value = true
  try {
    const result = await window.api.getStations()
    if (result.success) {
      stations.value = result.data
    }
  } catch (error) {
    console.error('Failed to load stations:', error)
  } finally {
    isLoadingStations.value = false
  }
}

async function selectStation(station) {
  await authStore.selectStation(station)
  showStationSelect.value = false
}

function formatTime(timestamp, short = false) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (short) {
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

onMounted(() => {
  loadStations()
  scannerStore.setupIPCListeners()
  scannerStore.loadScanMode()
})
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>

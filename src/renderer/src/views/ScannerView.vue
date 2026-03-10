<template>
  <div class="max-w-2xl mx-auto">
    <!-- Scanner Card -->
    <div class="card-minimal text-center mb-6 relative overflow-hidden">
      <!-- Glow Effect -->
      <div class="absolute inset-0 bg-gradient-to-r from-primary-100/50 via-transparent to-primary-100/50 opacity-50"></div>
      
      <div class="relative">
        <!-- Scanner Animation -->
        <div class="w-24 h-24 mx-auto mb-6 relative">
          <div class="absolute inset-0 rounded-full bg-gradient-to-r from-primary-200 via-accent-200 to-primary-200 blur-xl opacity-60 animate-pulse"></div>
          <div class="relative w-full h-full rounded-full bg-gradient-to-br from-slate-50 to-zinc-100 border border-zinc-200 flex items-center justify-center">
            <div class="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-3xl shadow-lg">
              📡
            </div>
          </div>
          <!-- Scan Line -->
          <div class="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-primary-400 to-transparent animate-pulse"></div>
        </div>

        <h2 class="text-lg font-bold text-zinc-900 mb-1">พร้อมรับการสแกน</h2>
        <p class="text-sm text-zinc-500 mb-4">สแกนบาร์โค้ดผู้ป่วยได้เลย</p>

        <!-- Station Badge -->
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 border border-zinc-200">
          <span class="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
          <span class="text-sm font-medium text-zinc-700">{{ authStore.selectedStation?.name }}</span>
        </div>
      </div>
    </div>

    <!-- Mode Selector -->
    <div class="card-minimal mb-6">
      <h3 class="text-sm font-semibold text-zinc-700 mb-4">โหมดการสแกน</h3>
      <div class="grid grid-cols-2 gap-3">
        <button
          @click="scannerStore.setScanMode('checkup')"
          :class="{ 'ring-2 ring-primary-500 bg-primary-50 border-primary-200': scannerStore.scanMode === 'checkup' }"
          class="p-4 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 transition-all text-center"
        >
          <div class="text-2xl mb-2">🏢</div>
          <div class="font-medium text-zinc-900 text-sm">Checkup</div>
          <div class="text-xs text-zinc-500">ตรวจสุขภาพ</div>
        </button>
        <button
          @click="scannerStore.setScanMode('clinic')"
          :class="{ 'ring-2 ring-primary-500 bg-primary-50 border-primary-200': scannerStore.scanMode === 'clinic' }"
          class="p-4 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 transition-all text-center"
        >
          <div class="text-2xl mb-2">🏥</div>
          <div class="font-medium text-zinc-900 text-sm">Clinic</div>
          <div class="text-xs text-zinc-500">คลินิก</div>
        </button>
      </div>
    </div>

    <!-- Last Scan Result -->
    <div class="card-minimal mb-6">
      <h3 class="text-sm font-semibold text-zinc-700 mb-4">ผลการสแกนล่าสุด</h3>
      
      <div v-if="!scannerStore.lastScan" class="text-center py-8 text-zinc-400">
        <div class="text-4xl mb-2">📋</div>
        <p class="text-sm">ยังไม่มีการสแกน</p>
      </div>

      <div v-else :class="[
        'p-4 rounded-xl border-l-4',
        scannerStore.lastScan.success 
          ? 'bg-green-50 border-green-500' 
          : 'bg-red-50 border-red-500'
      ]">
        <div class="flex items-center gap-3">
          <span class="text-2xl">{{ scannerStore.lastScan.success ? '✅' : '❌' }}</span>
          <div class="flex-1">
            <p class="font-semibold" :class="scannerStore.lastScan.success ? 'text-zinc-900' : 'text-red-700'">
              {{ scannerStore.lastScan.patientName || scannerStore.lastScan.error }}
            </p>
            <p class="text-xs text-zinc-500 mt-0.5">
              {{ formatTime(scannerStore.lastScan.timestamp) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- History -->
    <div class="card-minimal">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-zinc-700">ประวัติการสแกน</h3>
        <button 
          v-if="scannerStore.scanHistory.length > 0"
          @click="scannerStore.clearHistory"
          class="text-xs text-zinc-500 hover:text-zinc-700"
        >
          ล้าง
        </button>
      </div>

      <div v-if="scannerStore.scanHistory.length === 0" class="text-center py-6 text-zinc-400 text-sm">
        ยังไม่มีประวัติการสแกน
      </div>

      <div v-else class="space-y-2 max-h-60 overflow-y-auto">
        <div
          v-for="(scan, index) in scannerStore.recentScans"
          :key="index"
          :class="[
            'flex items-center gap-3 p-3 rounded-lg',
            scan.success ? 'bg-zinc-50' : 'bg-red-50/50'
          ]"
        >
          <span class="text-lg">{{ scan.success ? '✅' : '❌' }}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate" :class="scan.success ? 'text-zinc-900' : 'text-red-700'">
              {{ scan.patientName || scan.error }}
            </p>
          </div>
          <span class="text-xs text-zinc-400 whitespace-nowrap">
            {{ formatTime(scan.timestamp) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useScannerStore } from '../stores/scanner'

const authStore = useAuthStore()
const scannerStore = useScannerStore()

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('th-TH', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  })
}

onMounted(() => {
  scannerStore.setupIPCListeners()
})
</script>

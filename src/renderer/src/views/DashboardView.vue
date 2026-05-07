<template>
  <div class="space-y-3 pb-6">

    <!-- Station bar -->
    <div class="flex items-center gap-2">
      <!-- Chips หรือ placeholder -->
      <div class="flex-1 flex flex-wrap gap-1.5 min-h-[28px] items-center">
        <template v-if="authStore.selectedStations.length > 0 && !showStationSelect">
          <span
            v-for="s in authStore.selectedStations"
            :key="s.id"
            class="badge-purple"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            {{ stationName(s) }}
          </span>
        </template>
        <span v-else-if="!showStationSelect" class="text-xs text-zinc-400">ยังไม่ได้เลือกจุดตรวจ</span>
      </div>

      <button
        @click="toggleStationPanel"
        class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all"
        :class="showStationSelect
          ? 'bg-purple-50 border-purple-200 text-purple-700'
          : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 shadow-sm'"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        จุดตรวจ
        <span
          v-if="authStore.selectedStations.length > 0"
          class="w-4 h-4 rounded-full bg-[#9333ea] text-white text-[9px] flex items-center justify-center font-bold"
        >
          {{ authStore.selectedStations.length }}
        </span>
      </button>
    </div>

    <!-- Station select panel -->
    <div v-if="showStationSelect" class="card animate-in">
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm font-semibold text-[#09090b]">เลือกจุดตรวจ</p>
        <span class="text-xs text-zinc-400">
          {{ authStore.selectedStations.length > 0 ? `เลือก ${authStore.selectedStations.length} จุด` : '' }}
        </span>
      </div>

      <div v-if="isLoadingStations" class="flex justify-center py-5">
        <div class="w-5 h-5 border-2 border-zinc-200 border-t-purple-500 rounded-full animate-spin"></div>
      </div>

      <div v-else-if="stations.length === 0" class="text-center py-5 text-zinc-400 text-xs">
        ไม่พบจุดตรวจ
      </div>

      <div v-else class="space-y-1 max-h-52 overflow-y-auto -mx-1 px-1">
        <div
          v-for="station in stations"
          :key="station.id"
          @click="authStore.toggleStation(station)"
          class="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all select-none"
          :class="authStore.isStationSelected(station.id)
            ? 'bg-purple-50 text-[#09090b]'
            : 'hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900'"
        >
          <div
            class="w-4 h-4 rounded-md border-2 shrink-0 flex items-center justify-center transition-all"
            :class="authStore.isStationSelected(station.id)
              ? 'bg-[#9333ea] border-[#9333ea]'
              : 'border-zinc-300'"
          >
            <svg v-if="authStore.isStationSelected(station.id)" class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm truncate">{{ station.name }}</p>
          </div>
          <span class="shrink-0 px-2 py-0.5 rounded-md text-xs font-bold bg-zinc-100 text-zinc-500 border border-zinc-200">#{{ station.id }}</span>
          <span v-if="station.isSpecial" class="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-600 border border-amber-100">พิเศษ</span>
        </div>
      </div>
    </div>

    <!-- Warning: no station -->
    <div
      v-if="!showStationSelect && !authStore.hasStations"
      class="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100"
    >
      <svg class="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
      </svg>
      <p class="text-xs text-amber-600 flex-1">กรุณาเลือกจุดตรวจก่อนสแกน</p>
      <button @click="toggleStationPanel" class="text-xs text-amber-600 font-medium underline underline-offset-2">เลือก</button>
    </div>

    <!-- Scanner Status -->
    <div class="card relative overflow-hidden">
      <!-- Purple glow bg -->
      <div
        class="absolute inset-0 pointer-events-none transition-opacity duration-500 rounded-2xl overflow-hidden"
        :class="authStore.hasStations ? 'opacity-100' : 'opacity-0'"
      >
        <div class="absolute -top-8 left-1/2 -translate-x-1/2 w-40 h-20 rounded-full bg-purple-100 blur-3xl"></div>
      </div>

      <div class="relative flex items-center gap-4">
        <!-- Scanner icon -->
        <div class="relative shrink-0">
          <div
            v-if="authStore.hasStations"
            class="absolute inset-1 rounded-xl bg-purple-400/20 blur-md animate-pulse"
          ></div>
          <div
            class="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-all"
            :class="authStore.hasStations
              ? 'bg-[#9333ea] shadow-purple-200'
              : 'bg-zinc-100'"
          >
            <svg
              class="w-7 h-7 transition-colors"
              :class="authStore.hasStations ? 'text-white' : 'text-zinc-400'"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
        </div>

        <!-- Status text -->
        <div class="flex-1">
          <p class="font-semibold text-[#09090b] text-sm">
            {{ authStore.hasStations ? 'พร้อมรับการสแกน' : 'ยังไม่พร้อม' }}
          </p>
          <p class="text-xs text-zinc-400 mt-0.5">
            {{ authStore.hasStations ? 'สแกนบาร์โค้ดผู้ป่วยได้เลย' : 'เลือกจุดตรวจก่อน' }}
          </p>
        </div>

        <!-- Mode pill -->
        <div class="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-zinc-200 bg-zinc-50">
          <span
            class="w-1.5 h-1.5 rounded-full transition-colors"
            :class="authStore.hasStations ? 'bg-[#10b981] animate-pulse' : 'bg-zinc-300'"
          ></span>
          <span class="text-[11px] font-medium text-zinc-500">Checkup</span>
        </div>
      </div>
    </div>

    <!-- Last Result -->
    <div class="card">
      <p class="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">ผลล่าสุด</p>

      <div v-if="!scannerStore.lastScan" class="flex items-center gap-2 text-zinc-300 py-0.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span class="text-xs text-zinc-400">ยังไม่มีการสแกน</span>
      </div>

      <div
        v-else
        class="flex items-center gap-3 px-3 py-2.5 rounded-xl"
        :class="scannerStore.lastScan.success ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'"
      >
        <div
          class="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center"
          :class="scannerStore.lastScan.success ? 'bg-[#10b981]/10' : 'bg-[#ef4444]/10'"
        >
          <svg
            class="w-4 h-4"
            :class="scannerStore.lastScan.success ? 'text-[#10b981]' : 'text-[#ef4444]'"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path v-if="scannerStore.lastScan.success" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p
            class="font-semibold text-sm truncate"
            :class="scannerStore.lastScan.success ? 'text-emerald-800' : 'text-red-700'"
          >
            {{ scannerStore.lastScan.patientName || scannerStore.lastScan.error }}
          </p>
          <p class="text-[10px] text-zinc-400 mt-0.5">{{ formatTime(scannerStore.lastScan.timestamp) }}</p>
        </div>
        <span :class="scannerStore.lastScan.success ? 'badge-success' : 'badge-danger'">
          {{ scannerStore.lastScan.success ? 'สำเร็จ' : 'ผิดพลาด' }}
        </span>
      </div>
    </div>

    <!-- History -->
    <div class="card">
      <div class="flex items-center justify-between mb-2">
        <p class="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
          ประวัติ
          <span v-if="scannerStore.scanHistory.length" class="normal-case text-zinc-300 ml-0.5">· {{ scannerStore.scanHistory.length }}</span>
        </p>
        <button
          v-if="scannerStore.scanHistory.length"
          @click="scannerStore.clearHistory"
          class="text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          ล้าง
        </button>
      </div>

      <div v-if="!scannerStore.scanHistory.length" class="flex items-center gap-2 text-zinc-300 py-0.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-xs text-zinc-400">ไม่มีประวัติ</span>
      </div>

      <div v-else class="space-y-0.5 max-h-40 overflow-y-auto">
        <div
          v-for="(scan, i) in scannerStore.recentScans"
          :key="i"
          class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors"
          :class="scan.success ? 'hover:bg-zinc-50' : 'bg-red-50/60'"
        >
          <div
            class="w-1.5 h-1.5 rounded-full shrink-0"
            :class="scan.success ? 'bg-[#10b981]' : 'bg-[#ef4444]'"
          ></div>
          <span class="flex-1 truncate text-xs" :class="scan.success ? 'text-zinc-700' : 'text-red-600'">
            {{ scan.patientName || scan.error }}
          </span>
          <span class="text-[10px] text-zinc-400 shrink-0">{{ formatTime(scan.timestamp, true) }}</span>
        </div>
      </div>
    </div>

    <!-- Debug Panel (dev only) -->
    <div class="card border-dashed border-zinc-300 bg-zinc-50/50">
      <p class="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">🧪 ทดสอบ (Dev)</p>
      <div class="flex gap-2">
        <input
          v-model="testBarcode"
          type="text"
          class="input flex-1 text-xs py-2"
          placeholder="พิมพ์ barcode แล้วกด Test"
          @keydown.enter="runTestScan"
        />
        <button
          @click="runTestScan"
          :disabled="!testBarcode || isTestLoading"
          class="shrink-0 px-3 py-2 rounded-xl bg-[#9333ea] text-white text-xs font-semibold disabled:opacity-40 transition-all hover:bg-[#7e22ce]"
        >
          {{ isTestLoading ? '...' : 'Test' }}
        </button>
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
const testBarcode = ref('')
const isTestLoading = ref(false)

async function runTestScan() {
  if (!testBarcode.value || isTestLoading.value) return
  isTestLoading.value = true
  try {
    await window.api.testScan(testBarcode.value)
    testBarcode.value = ''
  } finally {
    isTestLoading.value = false
  }
}

function stationName(s) {
  if (s.name) return s.name
  const found = stations.value.find(st => st.id === s.id)
  return found ? found.name : `#${s.id}`
}

async function loadStations() {
  isLoadingStations.value = true
  try {
    const result = await window.api.getStations()
    if (result.success) {
      stations.value = result.data
      authStore.selectedStations.forEach(sel => {
        if (!sel.name) {
          const found = result.data.find(s => s.id === sel.id)
          if (found) sel.name = found.name
        }
      })
    }
  } catch (e) {
    console.error('Failed to load stations:', e)
  } finally {
    isLoadingStations.value = false
  }
}

function toggleStationPanel() {
  showStationSelect.value = !showStationSelect.value
  if (showStationSelect.value && stations.value.length === 0) loadStations()
}

function formatTime(ts, short = false) {
  if (!ts) return ''
  const d = new Date(ts)
  if (short) return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

onMounted(() => {
  scannerStore.setupIPCListeners()
  if (authStore.selectedStations.some(s => !s.name)) loadStations()
})
</script>

<style scoped>
.animate-in {
  animation: slideIn 0.12s ease;
}
@keyframes slideIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>

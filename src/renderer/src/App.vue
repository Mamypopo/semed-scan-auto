<template>
  <div class="min-h-screen" style="background: #f4f4f6;">
    <!-- Header -->
    <header
      class="sticky top-0 z-50 h-12 px-4 flex items-center"
      style="background: rgba(255,255,255,0.85); backdrop-filter: blur(16px); border-bottom: 1px solid rgba(9,9,11,0.07); box-shadow: 0 1px 0 rgba(9,9,11,0.04);"
    >
      <div class="max-w-lg mx-auto w-full flex items-center justify-between">
        <!-- Brand -->
        <div class="flex items-center gap-2.5">
          <div
            class="w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs font-bold"
            style="background: linear-gradient(135deg, #696CFF, #5558e3); box-shadow: 0 2px 8px -2px rgba(105,108,255,0.5);"
          >S</div>
          <span class="text-sm font-semibold text-[#09090b] tracking-tight">SEMed <span class="font-normal text-zinc-400">Scanner</span></span>
          <span class="text-[10px] text-zinc-300 font-normal">v{{ appVersion }}</span>
        </div>

        <!-- Right -->
        <div v-if="authStore.isAuthenticated" class="flex items-center gap-2">
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-50 border border-zinc-200/80">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span class="text-xs text-zinc-500 font-medium">{{ authStore.user?.name }}</span>
          </div>
          <button
            @click="handleLogout"
            class="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
            title="ออกจากระบบ"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Update Banner -->
    <div v-if="updateStatus.type === 'available' || updateStatus.type === 'downloading' || updateStatus.type === 'downloaded'"
      class="sticky top-12 z-40 px-4 py-2 flex items-center justify-between gap-3"
      :style="updateStatus.type === 'downloaded'
        ? 'background:#696CFF; color:#fff;'
        : 'background:#fffbeb; border-bottom:1px solid #fde68a;'">
      <div class="flex items-center gap-2 text-xs">
        <svg v-if="updateStatus.type !== 'downloading'" class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        <svg v-else class="w-3.5 h-3.5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <span v-if="updateStatus.type === 'available'" style="color:#92400e;">
          พบเวอร์ชันใหม่ {{ updateStatus.version }} — กำลังดาวน์โหลด...
        </span>
        <span v-else-if="updateStatus.type === 'downloading'" style="color:#92400e;">
          ดาวน์โหลดอัพเดท {{ updateStatus.percent }}%
        </span>
        <span v-else>
          อัพเดทพร้อมแล้ว ({{ updateStatus.version }}) — รีสตาร์ทเพื่อติดตั้ง
        </span>
      </div>
      <button v-if="updateStatus.type === 'downloaded'"
        @click="window.api.installUpdate()"
        class="shrink-0 px-3 py-1 rounded-lg text-xs font-semibold"
        style="background:rgba(255,255,255,0.25); color:#fff;">
        รีสตาร์ทเดี๋ยวนี้
      </button>
    </div>

    <!-- Main -->
    <main class="max-w-lg mx-auto px-4 py-4">
      <div v-if="isInitializing" class="flex items-center justify-center py-20">
        <div class="w-6 h-6 border-2 border-zinc-200 border-t-purple-500 rounded-full animate-spin"></div>
      </div>
      <template v-else>
        <LoginView v-if="!authStore.isAuthenticated" />
        <DashboardView v-else />
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import Swal from 'sweetalert2'
import { useScanner } from './composables/useScanner'
import LoginView from './views/LoginView.vue'
import DashboardView from './views/DashboardView.vue'

const authStore = useAuthStore()
const isInitializing = ref(true)
const updateStatus = reactive({ type: null, version: null, percent: 0 })
const appVersion = __APP_VERSION__
useScanner()

async function handleLogout() {
  await authStore.logout()
}

onMounted(async () => {
  await authStore.verifyToken()
  isInitializing.value = false

  window.api.onUpdaterStatus((data) => {
    updateStatus.type = data.type
    if (data.version) updateStatus.version = data.version
    if (data.percent !== undefined) updateStatus.percent = data.percent
  })

  window.api.onAuthExpired(async () => {
    await authStore.logout()
    Swal.fire({
      icon: 'warning',
      title: 'หมดอายุการใช้งาน',
      text: 'กรุณาเข้าสู่ระบบใหม่',
      confirmButtonText: 'ตกลง',
      customClass: { popup: 'swal-app' }
    })
  })
})
</script>

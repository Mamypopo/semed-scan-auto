<template>
  <div class="min-h-screen bg-zinc-100">
    <!-- Top-bar navigation -->
    <header class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-200/60 px-4 h-12 flex items-center">
      <div class="max-w-lg mx-auto w-full flex items-center justify-between">
        <!-- Brand -->
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-lg bg-[#9333ea] flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-purple-200">
            S
          </div>
          <span class="text-sm font-semibold text-[#09090b] tracking-tight">SEMed Scanner</span>
        </div>

        <!-- Right side -->
        <div v-if="authStore.isAuthenticated" class="flex items-center gap-2">
          <span class="text-xs text-zinc-400 hidden sm:block">{{ authStore.user?.name }}</span>
          <button
            @click="handleLogout"
            class="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
            title="ออกจากระบบ"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Main -->
    <main class="max-w-lg mx-auto px-4 py-4">
      <div v-if="isInitializing" class="flex items-center justify-center py-20">
        <div class="w-7 h-7 border-2 border-zinc-200 border-t-purple-500 rounded-full animate-spin"></div>
      </div>
      <template v-else>
        <LoginView v-if="!authStore.isAuthenticated" />
        <DashboardView v-else />
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import { useScanner } from './composables/useScanner'
import LoginView from './views/LoginView.vue'
import DashboardView from './views/DashboardView.vue'

const authStore = useAuthStore()
const isInitializing = ref(true)
useScanner()

async function handleLogout() {
  await authStore.logout()
}

onMounted(async () => {
  await authStore.verifyToken()
  isInitializing.value = false
})
</script>

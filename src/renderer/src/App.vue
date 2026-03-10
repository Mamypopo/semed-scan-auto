<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-zinc-50 to-slate-100">
    <!-- Header -->
    <header class="glass-panel sticky top-0 z-50 px-6 py-4">
      <div class="max-w-5xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-xl shadow-lg shadow-primary-200">
            🏥
          </div>
          <div>
            <h1 class="text-lg font-semibold text-zinc-900 tracking-tight">SEMed Scanner</h1>
            <p class="text-xs text-zinc-500">ระบบสแกนบาร์โค้ด</p>
          </div>
        </div>
        
        <button 
          v-if="authStore.isAuthenticated"
          @click="handleLogout"
          class="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
          title="ออกจากระบบ"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-5xl mx-auto px-6 py-8">
      <!-- Loading State -->
      <div v-if="isInitializing" class="flex items-center justify-center py-20">
        <div class="w-12 h-12 border-3 border-zinc-200 border-t-primary-500 rounded-full animate-spin"></div>
      </div>

      <!-- Router View -->
      <template v-else>
        <LoginView v-if="!authStore.isAuthenticated" />
        <DashboardView v-else />
      </template>
    </main>

    <!-- Footer -->
    <footer class="fixed bottom-0 left-0 right-0 py-4 px-6">
      <div class="max-w-5xl mx-auto text-center text-xs text-zinc-400">
        <span>SEMed Scanner v1.0.0</span>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import LoginView from './views/LoginView.vue'
import DashboardView from './views/DashboardView.vue'

const authStore = useAuthStore()
const isInitializing = ref(true)

async function handleLogout() {
  await authStore.logout()
}

onMounted(async () => {
  // Verify token on startup
  await authStore.verifyToken()
  isInitializing.value = false
})
</script>

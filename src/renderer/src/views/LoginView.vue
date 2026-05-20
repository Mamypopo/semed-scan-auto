<template>
  <div class="max-w-sm mx-auto pt-6">
    <div class="card">
      <div class="text-center mb-6">
        <div
          class="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
          style="background:linear-gradient(135deg,#696CFF,#5558e3); box-shadow:0 4px 16px -4px rgba(105,108,255,0.5);"
        >S</div>
        <h1 class="text-base font-semibold text-[#09090b]">เข้าสู่ระบบ</h1>
        <p class="text-xs text-zinc-400 mt-1">ใช้บัญชี SEMed ของคุณ</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-zinc-500 mb-1.5">อีเมล</label>
          <input v-model="form.email" type="email" class="input"
            placeholder="name@semed.co.th" required autocomplete="email"/>
        </div>

        <div>
          <label class="block text-xs font-medium text-zinc-500 mb-1.5">รหัสผ่าน</label>
          <div class="relative">
            <input v-model="form.password" :type="showPassword ? 'text' : 'password'"
              class="input pr-10" placeholder="••••••••" required autocomplete="current-password"/>
            <button type="button" @click="showPassword = !showPassword"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
              <svg v-if="showPassword" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <input v-model="form.rememberMe" type="checkbox" id="rememberMe"
            class="w-3.5 h-3.5 rounded border-zinc-300 cursor-pointer"
            style="accent-color:#696CFF;"/>
          <label for="rememberMe" class="text-xs text-zinc-500 cursor-pointer select-none">จดจำฉันไว้</label>
        </div>

        <button type="submit" :disabled="authStore.isLoading" class="btn-primary mt-1">
          <svg v-if="authStore.isLoading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          {{ authStore.isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
        </button>
      </form>

      <div class="relative my-4">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-zinc-100"></div>
        </div>
        <div class="relative flex justify-center">
          <span class="bg-white px-2 text-[11px] text-zinc-400">หรือ</span>
        </div>
      </div>

      <button
        type="button"
        @click="handleMicrosoftLogin"
        :disabled="authStore.isLoading"
        class="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-all disabled:opacity-50"
      >
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
          <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
          <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
          <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
        </svg>
        เข้าสู่ระบบด้วย Microsoft
      </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const showPassword = ref(false)
const form = reactive({ email: '', password: '', rememberMe: false })

async function handleLogin() {
  await authStore.login(form.email, form.password, form.rememberMe)
}

async function handleMicrosoftLogin() {
  await authStore.loginWithMicrosoft()
}
</script>

<template>
  <div class="max-w-md mx-auto pt-10">
    <div class="text-center mb-10">
      <div class="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-3xl shadow-xl shadow-primary-200">
        🔐
      </div>
      <h2 class="text-2xl font-bold text-zinc-900 mb-2">เข้าสู่ระบบ</h2>
      <p class="text-sm text-zinc-500">ใช้บัญชี SEMed ของคุณ</p>
    </div>

    <form @submit.prevent="handleLogin" class="space-y-5">
      <div>
        <label class="block text-sm font-medium text-zinc-700 mb-2">อีเมล</label>
        <input
          v-model="form.email"
          type="email"
          class="input-minimal"
          placeholder="name@hospital.com"
          required
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-zinc-700 mb-2">รหัสผ่าน</label>
        <div class="relative">
          <input
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            class="input-minimal pr-12"
            placeholder="••••••••"
            required
          />
          <button
            type="button"
            @click="showPassword = !showPassword"
            class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            <svg v-if="showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          </button>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            v-model="form.rememberMe"
            type="checkbox"
            class="w-4 h-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
          />
          <span class="text-sm text-zinc-600">จดจำฉันไว้</span>
        </label>
      </div>

      <button
        type="submit"
        :disabled="authStore.isLoading"
        class="w-full btn-primary-pearl py-3.5 flex items-center justify-center gap-2"
      >
        <svg v-if="authStore.isLoading" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>{{ authStore.isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}</span>
      </button>
    </form>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const showPassword = ref(false)

const form = reactive({
  email: '',
  password: '',
  rememberMe: false
})

async function handleLogin() {
  await authStore.login(form.email, form.password, form.rememberMe)
}
</script>

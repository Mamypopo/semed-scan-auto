import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Swal from 'sweetalert2'

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  customClass: {
    popup: 'swal-pearl'
  }
})

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const token = ref(null)
  const selectedStation = ref(null)
  const isLoading = ref(false)
  const isAuthenticated = computed(() => !!token.value)

  // Actions
  async function login(email, password, rememberMe = false) {
    isLoading.value = true
    try {
      console.log('🔐 Attempting login...')
      const result = await window.api.login(email, password, rememberMe)
      console.log('🔐 Login result:', result)
      
      if (result.success) {
        // Extract only serializable fields
        const userData = {
          id: result.data?.user?.id,
          name: result.data?.user?.name,
          email: result.data?.user?.email,
          role: result.data?.user?.role,
          permissions: result.data?.user?.permissions || []
        }
        
        user.value = userData
        token.value = result.data?.token
        
        // Save to electron store (only token, avoid user object issues)
        try {
          await window.api.saveConfig({
            token: token.value
          })
        } catch (saveError) {
          console.error('Failed to save config:', saveError)
        }
        
        Toast.fire({
          icon: 'success',
          title: `ยินดีต้อนรับ ${userData.name || userData.email}`
        })
        
        return { success: true }
      } else {
        throw new Error(result.message || 'เข้าสู่ระบบไม่สำเร็จ')
      }
    } catch (error) {
      console.error('Login error:', error)
      Swal.fire({
        icon: 'error',
        title: 'เข้าสู่ระบบไม่สำเร็จ',
        text: error.message || 'กรุณาตรวจสอบอีเมลและรหัสผ่าน',
        customClass: {
          popup: 'swal-pearl'
        }
      })
      return { success: false, error }
    } finally {
      isLoading.value = false
    }
  }

  async function verifyToken() {
    try {
      const config = await window.api.getConfig()
      if (!config.token) return false
      
      const result = await window.api.verifyToken()
      if (result.success) {
        token.value = config.token
        // Extract only serializable fields
        const userData = result.data?.user
        user.value = userData ? {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          permissions: userData.permissions || []
        } : null
        
        if (config.stationId) {
          selectedStation.value = {
            id: config.stationId,
            name: config.stationName
          }
        }
        return true
      }
      return false
    } catch (error) {
      console.error('Token verification failed:', error)
      return false
    }
  }

  async function selectStation(station) {
    selectedStation.value = station
    await window.api.saveConfig({
      token: token.value,
      stationId: station.id,
      stationName: station.name
    })
  }

  async function logout() {
    await window.api.clearConfig()
    user.value = null
    token.value = null
    selectedStation.value = null
    
    Toast.fire({
      icon: 'info',
      title: 'ออกจากระบบสำเร็จ'
    })
  }

  return {
    user,
    token,
    selectedStation,
    isLoading,
    isAuthenticated,
    login,
    verifyToken,
    selectStation,
    logout
  }
})

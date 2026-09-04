import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import Swal from 'sweetalert2'

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 4000,
  timerProgressBar: true,
  customClass: {
    popup: 'swal-app'
  }
})

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(null)
  const selectedStations = ref([])
  const selectedCNGroup = ref(null)
  const workflowMode = ref(null) // 'checkpoint' | 'recheck'
  const isLoading = ref(false)
  const scanInputMode = ref('auto')
  const isAuthenticated = computed(() => !!token.value)
  const hasStations = computed(() => selectedStations.value.length > 0)
  const hasCNGroup = computed(() => !!selectedCNGroup.value)
  const hasWorkflowMode = computed(() => !!workflowMode.value)
  const isRecheckMode = computed(() => workflowMode.value === 'recheck')

  function isStationSelected(id) {
    return selectedStations.value.some(s => s.id === id)
  }

  async function saveStationsToConfig() {
    await window.api.saveConfig({
      token: token.value,
      stationIds: selectedStations.value.map(s => s.id)
    })
  }

  async function selectCNGroup(group) {
    selectedCNGroup.value = { id: group.id, name: group.name, code: group.code }
    await window.api.saveConfig({ cnGroupId: group.id })
  }

  async function clearCNGroup() {
    selectedCNGroup.value = null
    await window.api.saveConfig({ cnGroupId: null })
  }

  /**
   * เลือก/สลับโหมดการทำงาน (checkpoint ↔ recheck)
   * เคลียร์ Station + CNGroup ที่เลือกไว้เสมอ กัน config ของโหมดเก่าหลุดข้ามมาใช้ผิด
   */
  async function selectWorkflowMode(mode) {
    workflowMode.value = mode
    selectedStations.value = []
    selectedCNGroup.value = null
    await window.api.saveConfig({ workflowMode: mode, stationIds: [], cnGroupId: null })
  }

  async function resetWorkflowMode() {
    workflowMode.value = null
    selectedStations.value = []
    selectedCNGroup.value = null
    await window.api.saveConfig({ workflowMode: null, stationIds: [], cnGroupId: null })
  }

  async function toggleScanInputMode() {
    scanInputMode.value = scanInputMode.value === 'auto' ? 'manual' : 'auto'
    await window.api.saveConfig({ scanInputMode: scanInputMode.value })
  }

  async function clearStations() {
    selectedStations.value = []
    await saveStationsToConfig()
  }

  async function toggleStation(station) {
    const idx = selectedStations.value.findIndex(s => s.id === station.id)
    if (idx >= 0) {
      selectedStations.value.splice(idx, 1)
    } else {
      selectedStations.value.push({ id: station.id, name: station.name })
    }
    await saveStationsToConfig()
  }

  async function login(email, password, rememberMe = false) {
    isLoading.value = true
    try {
      const result = await window.api.login(email, password, rememberMe)

      if (result.success) {
        const userData = {
          id: result.data?.user?.id,
          name: result.data?.user?.name,
          email: result.data?.user?.email,
          role: result.data?.user?.role,
          permissions: result.data?.user?.permissions || []
        }

        user.value = userData
        token.value = result.data?.token

        await window.api.saveConfig({ token: token.value })

        Toast.fire({
          icon: 'success',
          title: `ยินดีต้อนรับ ${userData.name || userData.email}`
        })

        return { success: true }
      } else {
        throw new Error(result.message || 'เข้าสู่ระบบไม่สำเร็จ')
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'เข้าสู่ระบบไม่สำเร็จ',
        text: error.message || 'กรุณาตรวจสอบอีเมลและรหัสผ่าน',
        customClass: { popup: 'swal-app' }
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
        const userData = result.data?.user
        user.value = userData ? {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          permissions: userData.permissions || []
        } : null

        if (Array.isArray(config.stationIds) && config.stationIds.length > 0) {
          selectedStations.value = config.stationIds.map(id => ({ id, name: '' }))
        }
        if (config.cnGroupId) {
          selectedCNGroup.value = { id: config.cnGroupId, name: '' }
        }
        if (config.workflowMode) {
          workflowMode.value = config.workflowMode
        }
        scanInputMode.value = 'manual'
        await window.api.saveConfig({ scanInputMode: 'manual' })
        return true
      }
      return false
    } catch (error) {
      console.error('Token verification failed:', error)
      return false
    }
  }

  async function loginWithMicrosoft() {
    isLoading.value = true
    try {
      const result = await window.api.loginMicrosoft()
      if (!result.success) {
        throw new Error(result.message || 'เข้าสู่ระบบด้วย Microsoft ไม่สำเร็จ')
      }

      token.value = result.token
      await window.api.saveConfig({ token: result.token })

      const verify = await window.api.verifyToken()
      if (verify.success) {
        const userData = verify.data?.user
        user.value = userData ? {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          permissions: userData.permissions || []
        } : null
      }

      Toast.fire({ icon: 'success', title: `ยินดีต้อนรับ ${user.value?.name || ''}` })
      return { success: true }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'เข้าสู่ระบบไม่สำเร็จ',
        text: error.message,
        customClass: { popup: 'swal-app' }
      })
      return { success: false, error }
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    await window.api.clearConfig()
    user.value = null
    token.value = null
    selectedStations.value = []
    selectedCNGroup.value = null
    workflowMode.value = null

    Toast.fire({
      icon: 'info',
      title: 'ออกจากระบบสำเร็จ'
    })
  }

  return {
    user,
    token,
    selectedStations,
    selectedCNGroup,
    workflowMode,
    isLoading,
    scanInputMode,
    isAuthenticated,
    hasStations,
    hasCNGroup,
    hasWorkflowMode,
    isRecheckMode,
    isStationSelected,
    toggleStation,
    clearStations,
    selectCNGroup,
    clearCNGroup,
    selectWorkflowMode,
    resetWorkflowMode,
    toggleScanInputMode,
    login,
    loginWithMicrosoft,
    verifyToken,
    logout
  }
})

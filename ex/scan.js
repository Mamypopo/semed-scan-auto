import { apiClient } from './api.js'

const scanService = {
  /**
   * สแกนจุดตรวจ
   * @param {string} cn - CN หรือ CN.STATION_ID
   * @param {number} stationId - Station ID (ถ้าไม่ส่งใน cn)
   * @param {string} cnGroupId - CNGroup ID (optional)
   */
  async scanCheckpoint(cn, stationId = null, cnGroupId = null, deleteRemark = false) {
    const response = await apiClient.post('/scan/checkpoint', {
      cn,
      stationId,
      cnGroupId,
      deleteRemark,
    })
    return response.data
  },

  /**
   * ยกเลิกการสแกน
   * @param {string} scanItemId - ScanItem ID
   */
  async cancelScan(scanItemId) {
    const response = await apiClient.delete(`/scan/${scanItemId}`)
    return response.data
  },


  /**
   * ดึงรายชื่อบริษัททั้งหมดใน CNGroup (สำหรับ Company Filter)
   * @param {string} cnGroupId - CNGroup ID
   * @returns {Promise<Array<string>>} รายชื่อบริษัท
   */
  async getCompanies(cnGroupId) {
    const response = await apiClient.get(`/scan/companies?cnGroupId=${cnGroupId}`)
    return response.data
  },

  /**
   * ดึงรายชื่อแผนกทั้งหมดใน CNGroup (สำหรับ Department Filter)
   * @param {string} cnGroupId - CNGroup ID
   * @param {Array<string>} companies - Array of company names to filter (optional)
   * @returns {Promise<Array<string>>} รายชื่อแผนก
   */
  async getDepartments(cnGroupId, companies = []) {
    const params = new URLSearchParams()
    params.append('cnGroupId', cnGroupId)
    if (companies && companies.length > 0) {
      companies.forEach(company => {
        params.append('companies[]', company)
      })
    }

    const response = await apiClient.get(`/scan/departments?${params.toString()}`)
    return response.data
  },

  /**
   * ดึงรายการสแกน
   * @param {object} filters - ตัวกรอง
   */
  async getList(filters = {}) {
    const params = new URLSearchParams()
    if (filters.cnGroupId) params.append('cnGroupId', filters.cnGroupId)
    if (filters.stationId) params.append('stationId', filters.stationId)
    if (filters.page) params.append('page', filters.page)
    if (filters.limit) params.append('limit', filters.limit)
    if (filters.search) params.append('search', filters.search)
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.append('dateTo', filters.dateTo)
    if (filters.isCancelled !== undefined) {
      params.append('isCancelled', filters.isCancelled)
    }

    const response = await apiClient.get(`/scan/list?${params.toString()}`)
    return response.data
  },

  /**
   * ดึงรายชื่อ patients สำหรับ Scan Modal
   * @param {string} cnGroupId - CNGroup ID
   * @param {string} status - 'all', 'registered', 'unregistered', 'special_checkup'
   * @param {object} options - { search, page, limit, sortBy, sortOrder, remarkFilter, companies }
   * @returns {Promise<object>} รายการ patients พร้อม pagination
   */
  async getPatientsByScanStatus(cnGroupId, status, options = {}) {
    const params = new URLSearchParams()
    if (options.search) params.append('search', options.search)
    if (options.page) params.append('page', options.page)
    if (options.limit) params.append('limit', options.limit)
    if (options.sortBy) params.append('sortBy', options.sortBy)
    if (options.sortOrder) params.append('sortOrder', options.sortOrder)
    if (options.remarkFilter) params.append('remarkFilter', options.remarkFilter)
    if (options.companies && options.companies.length > 0) {
      params.append('companies', JSON.stringify(options.companies))
    }
    if (options.createdByUserIds && options.createdByUserIds.length > 0) {
      params.append('createdByUserIds', JSON.stringify(options.createdByUserIds))
    }

    const response = await apiClient.get(`/scan/patients/${cnGroupId}/${status}?${params.toString()}`)
    return response.data
  },

  /**
   * ดึงรายการสแกนตาม Membership ID
   * @param {string} membershipId - Membership ID (required)
   * @param {object} options - { page, limit, isCancelled }
   * @returns {Promise<object>} รายการสแกนพร้อม pagination
   */
  async getScanItemsByMembership(membershipId, options = {}) {
    if (!membershipId) {
      throw new Error('กรุณาระบุ membershipId')
    }

    const params = new URLSearchParams()
    if (options.page) params.append('page', options.page)
    if (options.limit) params.append('limit', options.limit)
    // ส่ง isCancelled เฉพาะเมื่อมีค่า (undefined = แสดงทั้งหมด)
    if (options.isCancelled !== undefined && options.isCancelled !== null) {
      params.append('isCancelled', options.isCancelled)
    }

    const response = await apiClient.get(`/scan/membership/${membershipId}?${params.toString()}`)
    return response.data
  },

  /**
   * ดึงรายชื่อ patients ตาม Station
   * @param {string} cnGroupId - CNGroup ID
   * @param {number} stationId - Station ID
   * @param {object} options - { search, page, limit, sortBy, sortOrder, scanStatus, registrationStatus, stationRemarkFilter, companies }
   * @returns {Promise<object>} รายการ patients พร้อม pagination
   */
  async getPatientsByStation(cnGroupId, stationId, options = {}) {
    const params = new URLSearchParams()
    if (options.search) params.append('search', options.search)
    if (options.page) params.append('page', options.page)
    if (options.limit) params.append('limit', options.limit)
    if (options.sortBy) params.append('sortBy', options.sortBy)
    if (options.sortOrder) params.append('sortOrder', options.sortOrder)
    if (options.scanStatus) params.append('scanStatus', options.scanStatus)
    if (options.registrationStatus) params.append('registrationStatus', options.registrationStatus)
    if (options.stationRemarkFilter) params.append('stationRemarkFilter', options.stationRemarkFilter)
    if (options.companies && options.companies.length > 0) {
      params.append('companies', JSON.stringify(options.companies))
    }
    if (options.createdByUserIds && options.createdByUserIds.length > 0) {
      params.append('createdByUserIds', JSON.stringify(options.createdByUserIds))
    }
    if (options.examType) params.append('examType', options.examType)

    const response = await apiClient.get(`/scan/station/${cnGroupId}/${stationId}/patients?${params.toString()}`)
    return response.data
  },

  /**
   * ดึงรายชื่อ patients ตาม Station สำหรับ Customer (Public view)
   * - Summary แสดงข้อมูลทั้งหมดของ station เสมอ (ไม่กรองตาม filter)
   * @param {string} cnGroupId - CNGroup ID
   * @param {number} stationId - Station ID
   * @param {object} options - { search, page, limit, sortBy, sortOrder, scanStatus, registrationStatus, stationRemarkFilter, companies }
   * @returns {Promise<object>} รายการ patients พร้อม pagination และ summary (total)
   */
  async getPatientsByStationForCustomer(cnGroupId, stationId, options = {}) {
    const params = new URLSearchParams()
    if (options.search) params.append('search', options.search)
    if (options.page) params.append('page', options.page)
    if (options.limit) params.append('limit', options.limit)
    if (options.sortBy) params.append('sortBy', options.sortBy)
    if (options.sortOrder) params.append('sortOrder', options.sortOrder)
    if (options.scanStatus) params.append('scanStatus', options.scanStatus)
    if (options.registrationStatus) params.append('registrationStatus', options.registrationStatus)
    if (options.stationRemarkFilter) params.append('stationRemarkFilter', options.stationRemarkFilter)
    if (options.companies && options.companies.length > 0) {
      params.append('companies', JSON.stringify(options.companies))
    }

    const response = await apiClient.get(`/scan/customer/${cnGroupId}/${stationId}/patients?${params.toString()}`)
    return response.data
  },

  /**
   * ดึงรายชื่อ Users ที่เคยลงทะเบียนใน CNGroup นั้น (สำหรับ User Filter)
   * @param {string} cnGroupId - CNGroup ID
   * @returns {Promise<Array>} [{ id, name }]
   */
  async getRegisteringUsers(cnGroupId) {
    const response = await apiClient.get(`/scan/registering-users/${cnGroupId}`)
    return response.data
  },

  /**
   * ดึงสถิติการยิงตัวอย่างของ user วันนี้
   * @param {string} cnGroupId - CNGroup ID
   * @returns {Promise<Array>} รายการสถิติแยกตาม station
   */
  async getUserScanSummaryToday(cnGroupId) {
    const params = new URLSearchParams()
    if (cnGroupId) params.append('cnGroupId', cnGroupId)
    const response = await apiClient.get(`/scan/summary/me?${params.toString()}`)
    return response.data
  },

}

export default scanService


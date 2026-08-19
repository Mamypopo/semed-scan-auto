const Store = require('electron-store').default

const store = new Store({
  name: 'config',
  defaults: {
    token: '',
    stationIds: '[]',
    cnGroupId: '',
    baseUrl: '',
    scanInputMode: 'manual'
  }
})

const getToken = () => store.get('token')

const getStationIds = () => {
  try { return JSON.parse(store.get('stationIds') || '[]') } catch { return [] }
}
const setStationIds = (ids) => store.set('stationIds', JSON.stringify(ids))

const getCnGroupId = () => store.get('cnGroupId') || null
const setCnGroupId = (id) => store.set('cnGroupId', id || '')

const getScanInputMode = () => store.get('scanInputMode') || 'auto'
const setScanInputMode = (mode) => store.set('scanInputMode', mode)

const getConfig = () => ({
  token: store.get('token'),
  stationIds: getStationIds(),
  cnGroupId: getCnGroupId(),
  baseUrl: store.get('baseUrl'),
  scanInputMode: getScanInputMode()
})

const saveConfig = (config) => {
  if (config.token !== undefined) store.set('token', config.token)
  if (config.stationIds !== undefined) setStationIds(config.stationIds)
  if (config.cnGroupId !== undefined) setCnGroupId(config.cnGroupId)
  if (config.baseUrl !== undefined) store.set('baseUrl', config.baseUrl)
  if (config.scanInputMode !== undefined) setScanInputMode(config.scanInputMode)
}

const clearConfig = () => {
  store.clear()
}

module.exports = {
  getToken,
  getStationIds,
  setStationIds,
  getCnGroupId,
  setCnGroupId,
  getScanInputMode,
  setScanInputMode,
  getConfig,
  saveConfig,
  clearConfig
}

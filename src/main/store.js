const Store = require('electron-store').default

const store = new Store({
  name: 'config',
  defaults: {
    token: '',
    stationIds: '[]',
    baseUrl: '',
    scanInputMode: 'auto'
  }
})

const getToken = () => store.get('token')
const setToken = (token) => store.set('token', token)

const getStationIds = () => {
  try { return JSON.parse(store.get('stationIds') || '[]') } catch { return [] }
}
const setStationIds = (ids) => store.set('stationIds', JSON.stringify(ids))

const getStationId = () => {
  const ids = getStationIds()
  return ids.length ? ids[0] : ''
}

const getBaseUrl = () => store.get('baseUrl')
const setBaseUrl = (baseUrl) => store.set('baseUrl', baseUrl)

const getScanInputMode = () => store.get('scanInputMode') || 'auto'
const setScanInputMode = (mode) => store.set('scanInputMode', mode)

const getConfig = () => ({
  token: store.get('token'),
  stationIds: getStationIds(),
  baseUrl: store.get('baseUrl'),
  scanInputMode: getScanInputMode()
})

const saveConfig = (config) => {
  if (config.token !== undefined) store.set('token', config.token)
  if (config.stationIds !== undefined) setStationIds(config.stationIds)
  if (config.baseUrl !== undefined) store.set('baseUrl', config.baseUrl)
  if (config.scanInputMode !== undefined) setScanInputMode(config.scanInputMode)
}

const clearConfig = () => {
  store.clear()
}

module.exports = {
  getToken,
  setToken,
  getStationIds,
  setStationIds,
  getStationId,
  getBaseUrl,
  setBaseUrl,
  getScanInputMode,
  setScanInputMode,
  getConfig,
  saveConfig,
  clearConfig
}

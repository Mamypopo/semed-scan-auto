const Store = require('electron-store').default

const store = new Store({
  name: 'config',
  defaults: {
    token: '',
    stationId: '',
    stationName: '',
    baseUrl: ''
  }
})

const getToken = () => store.get('token')
const setToken = (token) => store.set('token', token)

const getStationId = () => store.get('stationId')
const setStationId = (stationId) => store.set('stationId', stationId)

const getStationName = () => store.get('stationName')
const setStationName = (stationName) => store.set('stationName', stationName)

const getBaseUrl = () => store.get('baseUrl')
const setBaseUrl = (baseUrl) => store.set('baseUrl', baseUrl)

const getConfig = () => ({
  token: store.get('token'),
  stationId: store.get('stationId'),
  stationName: store.get('stationName'),
  baseUrl: store.get('baseUrl')
})

const saveConfig = (config) => {
  if (config.token !== undefined) store.set('token', config.token)
  if (config.stationId !== undefined) store.set('stationId', config.stationId)
  if (config.stationName !== undefined) store.set('stationName', config.stationName)
  if (config.baseUrl !== undefined) store.set('baseUrl', config.baseUrl)
}

const clearConfig = () => {
  store.clear()
}

module.exports = {
  getToken,
  setToken,
  getStationId,
  setStationId,
  getStationName,
  setStationName,
  getBaseUrl,
  setBaseUrl,
  getScanMode,
  setScanMode,
  getConfig,
  saveConfig,
  clearConfig
}

const fs = require('fs')
const path = require('path')

const ALL_TIME_LAPS_FILE_PATH = path.join(__dirname, '../data/all-time-laps.json')
const SCHEMA_VERSION = 1
const MAX_TOP_TEN_SIZE = 10

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createDefaultAllTimeLapState() {
  return {
    topTen: [],
    history: []
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeLapEntry(entry) {
  if (!isObject(entry)) {
    return null
  }

  const driverName = typeof entry.driverName === 'string' ? entry.driverName.trim() : ''
  const carNumber = Number(entry.carNumber)
  const lapTime = Number(entry.lapTime)
  const recordedAt = Number(entry.recordedAt)

  if (!driverName) return null
  if (!Number.isInteger(carNumber) || carNumber < 1) return null
  if (!Number.isFinite(lapTime) || lapTime <= 0) return null
  if (!Number.isFinite(recordedAt) || recordedAt <= 0) return null

  return {
    driverName,
    carNumber,
    lapTime,
    recordedAt,
    sessionId: Number.isInteger(entry.sessionId) ? entry.sessionId : null
  }
}

function normalizeAllTimeLapState(value) {
  if (!isObject(value)) {
    return createDefaultAllTimeLapState()
  }

  const history = Array.isArray(value.history)
    ? value.history.map(normalizeLapEntry).filter(Boolean)
    : []

  const topTen = Array.isArray(value.topTen)
    ? value.topTen.map(normalizeLapEntry).filter(Boolean)
    : []

  topTen.sort((a, b) => a.lapTime - b.lapTime || a.recordedAt - b.recordedAt)

  return {
    topTen: topTen.slice(0, MAX_TOP_TEN_SIZE),
    history
  }
}

function loadPersistedAllTimeLapState() {
  try {
    if (!fs.existsSync(ALL_TIME_LAPS_FILE_PATH)) {
      return createDefaultAllTimeLapState()
    }

    const raw = fs.readFileSync(ALL_TIME_LAPS_FILE_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    const candidate = parsed && parsed.state ? parsed.state : parsed

    return normalizeAllTimeLapState(candidate)
  } catch (error) {
    console.warn('[persistence] Failed to load all-time lap state. Falling back to defaults.', error.message)
    return createDefaultAllTimeLapState()
  }
}

function savePersistedAllTimeLapState(state) {
  const directory = path.dirname(ALL_TIME_LAPS_FILE_PATH)
  fs.mkdirSync(directory, { recursive: true })

  const payload = {
    version: SCHEMA_VERSION,
    savedAt: Date.now(),
    state: normalizeAllTimeLapState(state)
  }

  const serialized = JSON.stringify(payload, null, 2)
  const tempPath = `${ALL_TIME_LAPS_FILE_PATH}.tmp`

  fs.writeFileSync(tempPath, serialized, 'utf8')
  fs.renameSync(tempPath, ALL_TIME_LAPS_FILE_PATH)

  return deepClone(payload.state)
}

module.exports = {
  MAX_TOP_TEN_SIZE,
  createDefaultAllTimeLapState,
  loadPersistedAllTimeLapState,
  savePersistedAllTimeLapState
}

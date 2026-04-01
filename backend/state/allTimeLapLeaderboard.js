const {
  MAX_TOP_TEN_SIZE,
  loadPersistedAllTimeLapState,
  savePersistedAllTimeLapState
} = require('../persistence/allTimeLapStore')

const state = loadPersistedAllTimeLapState()

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function sortByLapTimeThenRecordedAt(entries) {
  return entries.sort((a, b) => a.lapTime - b.lapTime || a.recordedAt - b.recordedAt)
}

function normalizeLapEntry(entry) {
  if (!entry || typeof entry !== 'object') {
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

function getAllTimeLeaderboardTopTen() {
  return {
    success: true,
    topTen: deepClone(state.topTen),
    updatedAt: Date.now()
  }
}

function getAllTimeLapHistorySummary() {
  return {
    success: true,
    totalRecordedLaps: state.history.length,
    topTenCount: state.topTen.length
  }
}

function recordAllTimeLapEntry(entry) {
  const normalized = normalizeLapEntry(entry)
  if (!normalized) {
    return { success: false, error: 'Invalid lap entry payload' }
  }

  state.history.push(normalized)

  const previousTopTen = JSON.stringify(state.topTen)
  const candidate = state.topTen.concat(normalized)
  sortByLapTimeThenRecordedAt(candidate)
  state.topTen = candidate.slice(0, MAX_TOP_TEN_SIZE)

  savePersistedAllTimeLapState(state)

  const topTenChanged = previousTopTen !== JSON.stringify(state.topTen)
  const enteredTopTen = state.topTen.some((item) => {
    return (
      item.recordedAt === normalized.recordedAt &&
      item.carNumber === normalized.carNumber &&
      item.lapTime === normalized.lapTime &&
      item.driverName === normalized.driverName
    )
  })

  return {
    success: true,
    topTenChanged,
    enteredTopTen,
    entry: deepClone(normalized),
    topTen: deepClone(state.topTen)
  }
}

module.exports = {
  getAllTimeLeaderboardTopTen,
  getAllTimeLapHistorySummary,
  recordAllTimeLapEntry
}

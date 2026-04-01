const fs = require('fs')
const path = require('path')

const STATE_FILE_PATH = path.join(__dirname, '../data/state.json')
const SCHEMA_VERSION = 1

/**
 * Deep clone serializable values so callers never mutate shared references.
 */
function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Default empty app state used on first boot and recovery fallback.
 */
function createDefaultRaceState() {
  return {
    nextSessionId: 1,
    sessions: [],
    currentRace: {
      sessionId: null,
      mode: 'danger',
      startTime: null,
      laps: {}
    },
    lastFinishedRace: null,
    endedSession: null
  }
}

/**
 * Guard: true for plain object values.
 */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Lightweight schema guard for persisted state payloads.
 */
function hasBasicStateShape(value) {
  return (
    isObject(value) &&
    Number.isInteger(value.nextSessionId) &&
    Array.isArray(value.sessions) &&
    isObject(value.currentRace) &&
    Object.prototype.hasOwnProperty.call(value, 'lastFinishedRace') &&
    Object.prototype.hasOwnProperty.call(value, 'endedSession')
  )
}

/**
 * Load state snapshot from disk.
 * Falls back to defaults if file is missing, invalid, or unreadable.
 */
function loadPersistedRaceState() {
  try {
    if (!fs.existsSync(STATE_FILE_PATH)) {
      return createDefaultRaceState()
    }

    const raw = fs.readFileSync(STATE_FILE_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    const candidate = parsed && parsed.state ? parsed.state : parsed

    if (!hasBasicStateShape(candidate)) {
      console.warn('[persistence] Saved state is invalid. Falling back to defaults.')
      return createDefaultRaceState()
    }

    return deepClone(candidate)
  } catch (error) {
    console.warn('[persistence] Failed to load persisted state. Falling back to defaults.', error.message)
    return createDefaultRaceState()
  }
}

/**
 * Persist state snapshot atomically (write temp file, then rename).
 */
function savePersistedRaceState(state) {
  const directory = path.dirname(STATE_FILE_PATH)
  fs.mkdirSync(directory, { recursive: true })

  const payload = {
    version: SCHEMA_VERSION,
    savedAt: Date.now(),
    state
  }

  const serialized = JSON.stringify(payload, null, 2)
  const tempPath = `${STATE_FILE_PATH}.tmp`

  fs.writeFileSync(tempPath, serialized, 'utf8')
  fs.renameSync(tempPath, STATE_FILE_PATH)
}

/**
 * Reconcile loaded state after restart.
 * If an active race already expired while server was down, force finish mode.
 * Returns true when reconciliation changed state and should be persisted.
 */
function reconcileRaceStateOnStartup(state, raceDurationSeconds) {
  const race = state.currentRace

  if (!race || race.sessionId === null) {
    return false
  }

  if (race.mode === 'finish') {
    if (!state.lastFinishedRace) {
      state.lastFinishedRace = deepClone(race)
      return true
    }
    return false
  }

  if (typeof race.startTime !== 'number') {
    race.mode = 'finish'
    state.lastFinishedRace = deepClone(race)
    return true
  }

  const raceEndTime = race.startTime + raceDurationSeconds * 1000
  if (Date.now() >= raceEndTime) {
    race.mode = 'finish'
    state.lastFinishedRace = deepClone(race)
    return true
  }

  return false
}

module.exports = {
  createDefaultRaceState,
  loadPersistedRaceState,
  savePersistedRaceState,
  reconcileRaceStateOnStartup
}

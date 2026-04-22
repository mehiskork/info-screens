const { RACE_DURATION, KEYS } = require('../config/settings')
const {
  loadPersistedRaceState,
  savePersistedRaceState,
  reconcileRaceStateOnStartup
} = require('../persistence/localStateStore')

// Hydrate in-memory state from local snapshot at process start.
const state = loadPersistedRaceState()


// If an active race expired while the server was down, normalize it to finish.
if (reconcileRaceStateOnStartup(state, RACE_DURATION)) {
  savePersistedRaceState(state)
}

// Persist the full state after each successful mutating operation.
function persistState() {
  savePersistedRaceState(state)
}

function resetCurrentRace() {
  state.currentRace = {
    sessionId: null,
    mode: 'danger',
    startTime: null,
    laps: {}
  }
}

// ============ SESSION MANAGEMENT ============

/**
 * Step 1: Creates a new empty race session
 * Returns the new session object
 */
function addSession() {
  const newSession = {
    id: state.nextSessionId,
    drivers: []
  }

  state.sessions.push(newSession)
  state.nextSessionId++
  persistState()

  return { ...newSession }  // return a copy
}

/**
 * Helper: Sort drivers by car number (ascending, numeric)
 */
function sortDriversByCarNumber(drivers) {
  return drivers.sort((a, b) => a.carNumber - b.carNumber)
}

/**
 * Step 2: Get all sessions
 * Returns a deep copy to prevent external mutations
 * Filters out the currently active race session
 * Sorts drivers by car number in each session
 */
function getAllSessions() {
  // Filter out the active race session from the queue
  const queuedSessions = state.sessions.filter(session => {
    return session.id !== state.currentRace.sessionId
  })

  // Deep copy and sort drivers in each session
  const sessionsCopy = JSON.parse(JSON.stringify(queuedSessions))
  sessionsCopy.forEach(session => {
    sortDriversByCarNumber(session.drivers)
  })

  return sessionsCopy
}

/**
 * Step 3: Find a session by ID (helper function)
 * Returns the actual session object (for internal use) or null
 */
function getSessionById(sessionId) {
  return state.sessions.find(session => session.id === sessionId) || null
}

function isActiveSession(sessionId) {
  return state.currentRace.sessionId !== null
    && Number(sessionId) === Number(state.currentRace.sessionId)
}

function rejectActiveSessionMutation(sessionId) {
  if (isActiveSession(sessionId)) {
    return {
      success: false,
      error: 'Cannot modify a session while it is racing'
    }
  }

  return null
}

function isMissingCarNumber(carNumber) {
  return carNumber === undefined
    || carNumber === null
    || (typeof carNumber === 'string' && carNumber.trim() === '')
}

function getSmallestAvailableCarNumber(session) {
  const takenCars = new Set(session.drivers.map(driver => driver.carNumber))

  for (let carNumber = 1; carNumber <= 8; carNumber++) {
    if (!takenCars.has(carNumber)) {
      return carNumber
    }
  }

  return null
}


/**
 * Step 4: Add a driver to a session
 * Receptionist may specify the car number (1-8), otherwise the smallest
 * available car is assigned automatically.
 */
function addDriver(sessionId, driverName, carNumber) {

  const activeSessionError = rejectActiveSessionMutation(sessionId)
  if (activeSessionError) {
    return activeSessionError
  }
  // Validate driver name
  if (!driverName || typeof driverName !== 'string' || driverName.trim() === '') {
    return { success: false, error: 'Driver name is required' }
  }

  // Find the session
  const session = getSessionById(sessionId)
  if (!session) {
    return { success: false, error: 'Session not found' }
  }

  let carNum
  const shouldAutoAssignCar = isMissingCarNumber(carNumber)

  if (!shouldAutoAssignCar) {
    carNum = Number(carNumber)

    // Validate car number is a number
    if (!Number.isInteger(carNum)) {
      return { success: false, error: 'Car number must be a valid number' }
    }

    // Validate car number is in valid range (1-8)
    if (carNum < 1 || carNum > 8) {
      return { success: false, error: 'Car number must be between 1 and 8' }
    }
  }

  // Check if driver name already exists in this session
  const nameExists = session.drivers.some(d => d.name === driverName)
  if (nameExists) {
    return { success: false, error: 'Driver name must be unique in this session' }
  }

  if (shouldAutoAssignCar) {
    carNum = getSmallestAvailableCarNumber(session)

    if (carNum === null) {
      return { success: false, error: 'Session is full (max 8 drivers)' }
    }
  }

  // Check if car number is already taken in this session
  const carTaken = session.drivers.some(d => d.carNumber === carNum)
  if (carTaken) {
    return { success: false, error: `Car ${carNum} is already assigned in this session` }
  }

  // Check max drivers (8 cars available)
  if (session.drivers.length >= 8) {
    return { success: false, error: 'Session is full (max 8 drivers)' }
  }

  // Add the driver with the specified car number
  const newDriver = { name: driverName, carNumber: carNum }
  session.drivers.push(newDriver)
  persistState()

  return { success: true, driver: { ...newDriver } }
}

/**
 * Step 5: Get the next race session (first in queue)
 * Returns null if no sessions exist
 */
function getNextRaceSession() {
  const showPaddock = state.endedSession !== null

  // If no race is active, return the first queued session
  if (state.currentRace.sessionId === null) {
    if (state.sessions.length === 0) {
      return { success: false, error: 'No queued sessions' }
    }
    const session = JSON.parse(JSON.stringify(state.sessions[0]))
    sortDriversByCarNumber(session.drivers)
    return { success: true, state: 'upcoming', paddock: showPaddock, data: session }
  }

  // If a race is active, find the next queued session after it
  const activeIndex = state.sessions.findIndex(s => s.id === state.currentRace.sessionId)

  // If active session not found in queue (shouldn't happen), return first session
  if (activeIndex === -1) {
    if (state.sessions.length === 0) {
      return { success: false, error: 'No queued sessions' }
    }
    const session = JSON.parse(JSON.stringify(state.sessions[0]))
    sortDriversByCarNumber(session.drivers)
    return { success: true, state: 'upcoming', paddock: showPaddock, data: session }
  }

  // Return the next session after the active one
  const nextIndex = activeIndex + 1
  if (nextIndex >= state.sessions.length) {
    return { success: false, error: 'No queued sessions' }
  }

  const session = JSON.parse(JSON.stringify(state.sessions[nextIndex]))
  sortDriversByCarNumber(session.drivers)
  return { success: true, state: 'upcoming', paddock: showPaddock, data: session }
}

/**
 * Step 6: Remove a session
 */
function removeSession(sessionId) {

  const activeSessionError = rejectActiveSessionMutation(sessionId)
  if (activeSessionError) {
    return activeSessionError
  }
  const index = state.sessions.findIndex(s => s.id === sessionId)
  if (index === -1) {
    return { success: false, error: 'Session not found' }
  }

  state.sessions.splice(index, 1)
  persistState()
  return { success: true }
}

/**
 * Step 7: Remove a driver from a session
 */
function removeDriver(sessionId, driverName) {



  const activeSessionError = rejectActiveSessionMutation(sessionId)
  if (activeSessionError) {
    return activeSessionError
  }

  const session = getSessionById(sessionId)
  if (!session) {
    return { success: false, error: 'Session not found' }
  }

  const index = session.drivers.findIndex(d => d.name === driverName)
  if (index === -1) {
    return { success: false, error: 'Driver not found' }
  }

  session.drivers.splice(index, 1)
  persistState()
  return { success: true }
}

/**
 * Step 8: Update a driver in a session
 * Can update driver name (must check for uniqueness)
 * Cannot change car number as it's auto-assigned
 */
function updateDriver(sessionId, carNumber, newDriverName) {

  const activeSessionError = rejectActiveSessionMutation(sessionId)
  if (activeSessionError) {
    return activeSessionError
  }
  // Validate inputs
  if (!newDriverName || typeof newDriverName !== 'string' || newDriverName.trim() === '') {
    return { success: false, error: 'Driver name is required' }
  }

  // Find the session
  const session = getSessionById(sessionId)
  if (!session) {
    return { success: false, error: 'Session not found' }
  }

  // Find the driver by car number
  const driver = session.drivers.find(d => d.carNumber === carNumber)
  if (!driver) {
    return { success: false, error: 'Driver not found in this session' }
  }

  // Check if new name already exists (but allow same name if it's the same driver)
  const nameExists = session.drivers.some(d => d.name === newDriverName && d.carNumber !== carNumber)
  if (nameExists) {
    return { success: false, error: 'Driver name must be unique in this session' }
  }

  // Update the driver name
  driver.name = newDriverName
  persistState()

  return { success: true, driver: { ...driver } }
}

// ============ AUTHENTICATION ============

/**
 * Authenticate receptionist access key
 * Includes 500ms delay on wrong key (per requirements)
 */
async function authenticateReceptionist(accessKey) {
  if (accessKey === KEYS.receptionist) {
    return { success: true, role: 'receptionist' }
  } else {
    // 500ms delay on wrong key to prevent brute force
    await new Promise(resolve => setTimeout(resolve, 500))
    return { success: false, error: 'Invalid access key' }
  }
}

/**
 * Authenticate safety official access key
 * Includes 500ms delay on wrong key (per requirements)
 */
async function authenticateSafety(accessKey) {
  if (accessKey === KEYS.safety) {
    return { success: true, role: 'safety' }
  } else {
    // 500ms delay on wrong key to prevent brute force
    await new Promise(resolve => setTimeout(resolve, 500))
    return { success: false, error: 'Invalid access key' }
  }
}

/**
 * Authenticate lap-line observer access key
 * Includes 500ms delay on wrong key (per requirements)
 */
async function authenticateObserver(accessKey) {
  if (accessKey === KEYS.observer) {
    return { success: true, role: 'observer' }
  } else {
    // 500ms delay on wrong key to prevent brute force
    await new Promise(resolve => setTimeout(resolve, 500))
    return { success: false, error: 'Invalid access key' }
  }
}

// ============ RACE CONTROL ============

/**
 * Start a race session
 * Initializes currentRace with lap tracking for all drivers
 */
function startRace(sessionId) {
  // Find the session
  const session = getSessionById(sessionId)
  if (!session) {
    return { success: false, error: 'Session not found' }
  }

  // Check if session has drivers
  if (session.drivers.length === 0) {
    return { success: false, error: 'Cannot start race with no drivers' }
  }

  // Check if a race is already active
  if (state.currentRace.sessionId !== null) {
    return { success: false, error: 'A race is already in progress' }
  }

  // Clear ended session when starting new race (paddock flow complete)
  state.endedSession = null
  // Finished snapshot is only kept until the next race starts.
  state.lastFinishedRace = null

  // Initialize lap tracking for each car
  const laps = {}
  for (const driver of session.drivers) {
    laps[driver.carNumber] = {
      currentLap: 0,
      bestTime: null,
      lapTimes: [],
      lastCrossTime: null,
      finishLapCompleted: false
    }
  }

  // Set up currentRace
  state.currentRace = {
    sessionId: sessionId,
    drivers: JSON.parse(JSON.stringify(session.drivers)), // deep copy
    mode: 'safe',
    startTime: Date.now(),
    laps: laps
  }
  persistState()

  return { success: true, race: JSON.parse(JSON.stringify(state.currentRace)) }
}

/**
 * Change race mode
 * Valid modes: 'safe', 'hazard', 'danger', 'finish'
 * If mode is 'finish', race remains active until endSession()
 */
function changeRaceMode(mode) {
  // Check if a race is active
  if (state.currentRace.sessionId === null) {
    return { success: false, error: 'No active race' }
  }

  // Validate mode
  const validModes = ['safe', 'hazard', 'danger', 'finish']
  if (!validModes.includes(mode)) {
    return { success: false, error: 'Invalid mode. Must be: safe, hazard, danger, or finish' }
  }

  // Once race is in finish mode, mode can no longer transition.
  if (state.currentRace.mode === 'finish' && mode !== 'finish') {
    return { success: false, error: 'Race is already in finish mode and cannot change mode' }
  }

  if (state.currentRace.mode === 'finish' && mode === 'finish') {
    return { success: true, mode: state.currentRace.mode, message: 'Race is already in finish mode' }
  }

  // Enter finish mode. Session remains active until endSession() is called.
  if (mode === 'finish') {
    state.currentRace.mode = 'finish'
    state.lastFinishedRace = JSON.parse(JSON.stringify(state.currentRace))
    persistState()

    return { success: true, mode: state.currentRace.mode, message: 'Race finished - wait for session end confirmation' }
  }

  // Update mode for non-finished states
  state.currentRace.mode = mode
  persistState()

  return { success: true, mode: state.currentRace.mode }
}

/**
 * End the race session after cars have returned to pit lane
 * Called by Safety Official to finalize a race in finish mode.
 */
function endSession() {
  // Race must still be active.
  if (state.currentRace.sessionId === null) {
    return { success: false, error: 'No active race to end' }
  }

  // Session can only be ended from finish mode.
  if (state.currentRace.mode !== 'finish') {
    return { success: false, error: 'Race must be in finish mode before ending session' }
  }

  const sessionId = state.currentRace.sessionId
  const index = state.sessions.findIndex(s => s.id === sessionId)

  if (index !== -1) {
    state.endedSession = JSON.parse(JSON.stringify(state.sessions[index]))
    state.sessions.splice(index, 1)
  } else {
    // Fallback to current race snapshot if queued session was already removed.
    state.endedSession = {
      id: sessionId,
      drivers: JSON.parse(JSON.stringify(state.currentRace.drivers || []))
    }
  }

  state.lastFinishedRace = JSON.parse(JSON.stringify(state.currentRace))
  resetCurrentRace()
  persistState()

  return { success: true, message: 'Session ended - next session ready' }
}

/**
 * Get current race status with time remaining
 * Returns race data with calculated seconds remaining
 */
function getCurrentRaceStatus() {
  // Check if a race is active
  if (state.currentRace.sessionId === null) {
    const hasFrozenSnapshot = state.lastFinishedRace !== null
    return {
      success: false,
      error: 'No active race',
      hasActiveRace: false,
      isFrozenSnapshot: hasFrozenSnapshot,
      snapshotState: hasFrozenSnapshot ? 'post-race-frozen' : 'idle',
      lastFinishedRace: hasFrozenSnapshot ? JSON.parse(JSON.stringify(state.lastFinishedRace)) : null
    }
  }

  // Finish mode is a frozen post-race state while session is still active.
  // Status should always report 00:00 in this mode.
  const isFinishMode = state.currentRace.mode === 'finish'
  const elapsedSeconds = Math.floor((Date.now() - state.currentRace.startTime) / 1000)
  const secondsRemaining = isFinishMode
    ? 0
    : Math.max(0, RACE_DURATION - elapsedSeconds)

  // Return race data with time remaining
  return {
    success: true,
    hasActiveRace: true,
    isFrozenSnapshot: false,
    snapshotState: 'live',
    race: {
      ...JSON.parse(JSON.stringify(state.currentRace)),
      secondsRemaining,
      totalDuration: RACE_DURATION
    }
  }
}

/**
 * Get last finished race snapshot.
 */
function getLastFinishedRace() {
  if (state.lastFinishedRace === null) {
    return { success: false, error: 'No finished race available' }
  }

  return {
    success: true,
    race: JSON.parse(JSON.stringify(state.lastFinishedRace))
  }
}

function buildLeaderboardFromRace(race) {
  if (!race || !race.drivers || !race.laps) {
    return null
  }

  const leaderboard = race.drivers.map(driver => {
    const lapData = race.laps[driver.carNumber] || {
      bestTime: null,
      currentLap: 0,
      lapTimes: []
    }

    return {
      name: driver.name,
      carNumber: driver.carNumber,
      bestTime: lapData.bestTime,
      currentLap: lapData.currentLap,
      lapTimes: lapData.lapTimes.length
    }
  })

  leaderboard.sort((a, b) => {
    if (a.bestTime === null && b.bestTime === null) return 0
    if (a.bestTime === null) return 1
    if (b.bestTime === null) return -1
    return a.bestTime - b.bestTime
  })

  return leaderboard
}

/**
 * Record a lap crossing for a car
 * Calculates lap time if this is not the first crossing
 */
function recordLapCrossing(carNumber, timestamp = Date.now()) {
  // Check if a race is active
  if (state.currentRace.sessionId === null) {
    return { success: false, error: 'No active race' }
  }

  // Validate car number exists in this race
  if (!state.currentRace.laps[carNumber]) {
    return { success: false, error: 'Car not in this race' }
  }

  const carLaps = state.currentRace.laps[carNumber]
  const isFinishMode = state.currentRace.mode === 'finish'

  // In finish mode, each car can complete only one final lap crossing.
  if (isFinishMode && carLaps.finishLapCompleted) {
    return { success: false, error: 'Final lap already completed for this car' }
  }

  // Finish mode permits one final button press even if no previous crossing exists.
  if (isFinishMode && carLaps.lastCrossTime === null) {
    carLaps.finishLapCompleted = true
    persistState()

    return {
      success: true,
      lap: carLaps.currentLap,
      message: 'Final lap completion recorded - proceed to paddock',
      finishLapCompleted: true
    }
  }

  // If this is the first crossing, just record the time
  if (carLaps.lastCrossTime === null) {
    carLaps.lastCrossTime = timestamp
    carLaps.currentLap = 1
    persistState()
    return {
      success: true,
      lap: 1,
      message: 'First lap started',
      finishLapCompleted: false
    }
  }

  // Calculate lap time (time since last crossing)
  const lapTime = timestamp - carLaps.lastCrossTime

  // Store lap time
  carLaps.lapTimes.push(lapTime)
  carLaps.currentLap++
  carLaps.lastCrossTime = timestamp

  // Update best time if this is faster
  if (carLaps.bestTime === null || lapTime < carLaps.bestTime) {
    carLaps.bestTime = lapTime
  }

  if (isFinishMode) {
    carLaps.finishLapCompleted = true
  }

  persistState()

  return {
    success: true,
    lap: carLaps.currentLap,
    lapTime: lapTime,
    bestTime: carLaps.bestTime,
    finishLapCompleted: isFinishMode
  }
}

/**
 * Get leaderboard sorted by best lap time
 * Returns drivers sorted by fastest lap (fastest first)
 */
function getLeaderboard() {
  const hasActiveRace = state.currentRace.sessionId !== null
  const sourceRace = hasActiveRace ? state.currentRace : state.lastFinishedRace

  if (!sourceRace) {
    return { success: false, error: 'No active or finished race available' }
  }

  const leaderboard = buildLeaderboardFromRace(sourceRace)
  if (!leaderboard) {
    return { success: false, error: 'Race data is incomplete' }
  }

  return {
    success: true,
    hasActiveRace,
    isFrozenSnapshot: !hasActiveRace && state.lastFinishedRace !== null,
    snapshotState: hasActiveRace ? 'live' : 'post-race-frozen',
    source: hasActiveRace ? 'active' : 'lastFinished',
    lapDisplayMode: hasActiveRace ? 'currentLap' : 'completedLaps',
    sessionId: sourceRace.sessionId,
    raceMode: sourceRace.mode,
    leaderboard
  }
}

module.exports = {
  addSession,
  getAllSessions,
  getSessionById,
  addDriver,
  getNextRaceSession,
  removeSession,
  removeDriver,
  updateDriver,
  authenticateReceptionist,
  authenticateSafety,
  authenticateObserver,
  startRace,
  changeRaceMode,
  endSession,
  getCurrentRaceStatus,
  getLastFinishedRace,
  recordLapCrossing,
  getLeaderboard
}

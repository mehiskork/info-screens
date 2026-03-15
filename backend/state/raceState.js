const { RACE_DURATION } = require('../config/settings')

const state = {
  nextSessionId: 1,  // counter for generating IDs
  
  sessions: [], // start with empty sessions array
  
  currentRace: {
    sessionId: null,
    mode: 'danger',  // default safe state
    startTime: null,
    laps: {},    
  },
  
  // For "see last race" requirement
  lastFinishedRace: null  // copy of finished race data
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
  
  return { ...newSession }  // return a copy
}

/**
 * Step 2: Get all sessions
 * Returns a deep copy to prevent external mutations
 */
function getAllSessions() {
  return JSON.parse(JSON.stringify(state.sessions))
}

/**
 * Step 3: Find a session by ID (helper function)
 * Returns the actual session object (for internal use) or null
 */
function getSessionById(sessionId) {
  return state.sessions.find(session => session.id === sessionId) || null
}

/**
 * Step 4: Add a driver to a session
 * Auto-assigns the lowest available car number (1-8)
 */
function addDriver(sessionId, driverName) {
  // Validate inputs
  if (!driverName || typeof driverName !== 'string' || driverName.trim() === '') {
    return { success: false, error: 'Driver name is required' }
  }
  
  // Find the session
  const session = getSessionById(sessionId)
  if (!session) {
    return { success: false, error: 'Session not found' }
  }
  
  // Check if driver name already exists in this session
  const nameExists = session.drivers.some(d => d.name === driverName)
  if (nameExists) {
    return { success: false, error: 'Driver name must be unique in this session' }
  }
  
  // Check max drivers (8 cars available)
  if (session.drivers.length >= 8) {
    return { success: false, error: 'Session is full (max 8 drivers)' }
  }
  
  // Find lowest available car number (1-8)
  const usedCars = session.drivers.map(d => d.carNumber)
  let carNumber = null
  for (let i = 1; i <= 8; i++) {
    if (!usedCars.includes(i)) {
      carNumber = i
      break
    }
  }
  
  // Add the driver
  const newDriver = { name: driverName, carNumber }
  session.drivers.push(newDriver)
  
  return { success: true, driver: { ...newDriver } }
}

/**
 * Step 5: Get the next race session (first in queue)
 * Returns null if no sessions exist
 */
function getNextRaceSession() {
  if (state.sessions.length === 0) {
    return { success: false, error: 'No queued sessions' }
  }
  return { success: true, data: JSON.parse(JSON.stringify(state.sessions[0])) }
}

/**
 * Step 6: Remove a session
 */
function removeSession(sessionId) {
  const index = state.sessions.findIndex(s => s.id === sessionId)
  if (index === -1) {
    return { success: false, error: 'Session not found' }
  }
  
  state.sessions.splice(index, 1)
  return { success: true }
}

/**
 * Step 7: Remove a driver from a session
 */
function removeDriver(sessionId, driverName) {
  const session = getSessionById(sessionId)
  if (!session) {
    return { success: false, error: 'Session not found' }
  }
  
  const index = session.drivers.findIndex(d => d.name === driverName)
  if (index === -1) {
    return { success: false, error: 'Driver not found' }
  }
  
  session.drivers.splice(index, 1)
  return { success: true }
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
  
  // Initialize lap tracking for each car
  const laps = {}
  for (const driver of session.drivers) {
    laps[driver.carNumber] = {
      currentLap: 0,
      bestTime: null,
      lapTimes: [],
      lastCrossTime: null
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
  
  return { success: true, race: JSON.parse(JSON.stringify(state.currentRace)) }
}

/**
 * Change race mode
 * Valid modes: 'safe', 'racing', 'paused', 'finished'
 * If mode is 'finished', the race ends and moves to lastFinishedRace
 */
function changeRaceMode(mode) {
  // Check if a race is active
  if (state.currentRace.sessionId === null) {
    return { success: false, error: 'No active race' }
  }
  
  // Validate mode
  const validModes = ['safe', 'racing', 'paused', 'finished']
  if (!validModes.includes(mode)) {
    return { success: false, error: 'Invalid mode. Must be: safe, racing, paused, or finished' }
  }
  
  // If finishing the race, move it to lastFinishedRace and reset currentRace
  if (mode === 'finished') {
    state.currentRace.mode = 'finished'
    state.lastFinishedRace = JSON.parse(JSON.stringify(state.currentRace))
    
    // Remove the finished session from the queue
    const sessionId = state.currentRace.sessionId
    const index = state.sessions.findIndex(s => s.id === sessionId)
    if (index !== -1) {
      state.sessions.splice(index, 1)
    }
    
    // Reset current race
    state.currentRace = {
      sessionId: null,
      mode: null,
      startTime: null,
      laps: {}
    }
    
    return { success: true, message: 'Race finished and session removed from queue' }
  }
  
  // Update mode for non-finished states
  state.currentRace.mode = mode
  
  return { success: true, mode: state.currentRace.mode }
}

/**
 * Get current race status with time remaining
 * Returns race data with calculated seconds remaining
 */
function getCurrentRaceStatus() {
  // Check if a race is active
  if (state.currentRace.sessionId === null) {
    return { success: false, error: 'No active race' }
  }
  
  // Calculate time remaining
  const elapsedSeconds = Math.floor((Date.now() - state.currentRace.startTime) / 1000)
  const secondsRemaining = Math.max(0, RACE_DURATION - elapsedSeconds)
  
  // Return race data with time remaining
  return {
    success: true,
    race: {
      ...JSON.parse(JSON.stringify(state.currentRace)),
      secondsRemaining,
      totalDuration: RACE_DURATION
    }
  }
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
  
  // If this is the first crossing, just record the time
  if (carLaps.lastCrossTime === null) {
    carLaps.lastCrossTime = timestamp
    carLaps.currentLap = 1
    return { 
      success: true, 
      lap: 1,
      message: 'First lap started'
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
  
  return {
    success: true,
    lap: carLaps.currentLap,
    lapTime: lapTime,
    bestTime: carLaps.bestTime
  }
}

/**
 * Get leaderboard sorted by best lap time
 * Returns drivers sorted by fastest lap (fastest first)
 */
function getLeaderboard() {
  // Check if a race is active
  if (state.currentRace.sessionId === null) {
    return { success: false, error: 'No active race' }
  }
  
  // Build leaderboard with driver and lap data
  const leaderboard = state.currentRace.drivers.map(driver => {
    const lapData = state.currentRace.laps[driver.carNumber]
    return {
      name: driver.name,
      carNumber: driver.carNumber,
      bestTime: lapData.bestTime,
      currentLap: lapData.currentLap,
      lapTimes: lapData.lapTimes.length
    }
  })
  
  // Sort by best time (fastest first, drivers with no time go last)
  leaderboard.sort((a, b) => {
    if (a.bestTime === null && b.bestTime === null) return 0
    if (a.bestTime === null) return 1
    if (b.bestTime === null) return -1
    return a.bestTime - b.bestTime
  })
  
  return {
    success: true,
    leaderboard: leaderboard
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
  startRace,
  changeRaceMode,
  getCurrentRaceStatus,
  recordLapCrossing,
  getLeaderboard
}
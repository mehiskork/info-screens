const { RACE_DURATION, KEYS } = require('../config/settings')

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

/**
 * Step 4: Add a driver to a session
 * Receptionist must specify the car number (1-8)
 */
function addDriver(sessionId, driverName, carNumber) {
  // Validate driver name
  if (!driverName || typeof driverName !== 'string' || driverName.trim() === '') {
    return { success: false, error: 'Driver name is required' }
  }
  
  // Validate car number is provided
  if (carNumber === undefined || carNumber === null) {
    return { success: false, error: 'Car number is required' }
  }
  
  // Validate car number is a number
  const carNum = parseInt(carNumber, 10)
  if (isNaN(carNum)) {
    return { success: false, error: 'Car number must be a valid number' }
  }
  
  // Validate car number is in valid range (1-8)
  if (carNum < 1 || carNum > 8) {
    return { success: false, error: 'Car number must be between 1 and 8' }
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
  
  return { success: true, driver: { ...newDriver } }
}

/**
 * Step 5: Get the next race session (first in queue)
 * Returns null if no sessions exist
 */
function getNextRaceSession() {
  // If no race is active, return the first queued session
  if (state.currentRace.sessionId === null) {
    if (state.sessions.length === 0) {
      return { success: false, error: 'No queued sessions' }
    }
    const session = JSON.parse(JSON.stringify(state.sessions[0]))
    sortDriversByCarNumber(session.drivers)
    return { success: true, data: session }
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
    return { success: true, data: session }
  }
  
  // Return the next session after the active one
  const nextIndex = activeIndex + 1
  if (nextIndex >= state.sessions.length) {
    return { success: false, error: 'No queued sessions' }
  }
  
  const session = JSON.parse(JSON.stringify(state.sessions[nextIndex]))
  sortDriversByCarNumber(session.drivers)
  return { success: true, data: session }
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

/**
 * Step 8: Update a driver in a session
 * Can update driver name (must check for uniqueness)
 * Cannot change car number as it's auto-assigned
 */
function updateDriver(sessionId, carNumber, newDriverName) {
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
  updateDriver,
  authenticateReceptionist,
  authenticateSafety,
  authenticateObserver,
  startRace,
  changeRaceMode,
  getCurrentRaceStatus,
  recordLapCrossing,
  getLeaderboard
}
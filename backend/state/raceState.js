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
    return null
  }
  return JSON.parse(JSON.stringify(state.sessions[0]))
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

module.exports = {
  addSession,
  getAllSessions,
  getSessionById,
  addDriver,
  getNextRaceSession,
  removeSession,
  removeDriver
}
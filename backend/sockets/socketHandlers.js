/**
 * Socket.IO Event Handlers
 * Step-by-step implementation
 */

const { 
  getAllSessions,
  addSession,
  addDriver,
  removeSession,
  removeDriver,
  updateDriver,
  authenticateReceptionist,
  authenticateSafety,
  authenticateObserver,
  getNextRaceSession,
  startRace,
  changeRaceMode,
  endSession,
  getCurrentRaceStatus,
  recordLapCrossing,
  getLeaderboard
} = require('../state/raceState')

const ROLE = {
  PUBLIC: 'public',
  RECEPTIONIST: 'receptionist',
  SAFETY: 'safety',
  OBSERVER: 'observer'
}

function setSocketRole(socket, role) {
  socket.data.role = role
}

function isAuthorized(socket, requiredRole) {
  return socket.data.role === requiredRole
}

function rejectUnauthorized(callback, requiredRole) {
  if (typeof callback === 'function') {
    callback({
      success: false,
      error: `Unauthorized. ${requiredRole} role required.`
    })
  }
}

async function authenticateRole(role, accessKey) {
  if (role === ROLE.RECEPTIONIST) {
    return authenticateReceptionist(accessKey)
  }

  if (role === ROLE.SAFETY) {
    return authenticateSafety(accessKey)
  }

  if (role === ROLE.OBSERVER) {
    return authenticateObserver(accessKey)
  }

  return { success: false, error: 'Invalid role' }
}

/**
 * Broadcast current race state to all connected clients
 * Emits state:update event with race mode and timer information
 */
function broadcastState(io) {
  const result = getCurrentRaceStatus()

  if (!result.success) {
    io.emit("state:update", {
      raceMode: "DANGER",
      timer: { running: false }
    })
    return
  }
  
  const race = result.race
  console.log("BROADCAST:", race.mode)

  io.emit("state:update", {
    raceMode: race.mode.toUpperCase(),
    timer: {
      running: race.mode !== "finish",
      endsAt: race.startTime + result.race.totalDuration * 1000
    }
  })

  const now = Date.now()

  if (race.startTime && now >= race.startTime + result.race.totalDuration * 1000) {
    changeRaceMode("finish")
  }
}

/**
 * Initialize Socket.IO event handlers
 */
function initializeSocketHandlers(io) {
  io.use(async (socket, next) => {
    const auth = socket.handshake.auth || {}
    const role = typeof auth.role === 'string' ? auth.role.toLowerCase() : null
    const accessKey = typeof auth.accessKey === 'string' ? auth.accessKey : null

    // Spectator/public connections can connect without credentials.
    if (!role && !accessKey) {
      setSocketRole(socket, ROLE.PUBLIC)
      return next()
    }

    if (!role || !accessKey) {
      return next(new Error('Invalid auth payload. role and accessKey are required.'))
    }

    const result = await authenticateRole(role, accessKey)
    if (!result.success) {
      return next(new Error(result.error || 'Unauthorized'))
    }

    setSocketRole(socket, role)
    return next()
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id, 'role:', socket.data.role)
    
    // Get all sessions
    socket.on('getSessions', (callback) => {
      if (!isAuthorized(socket, ROLE.RECEPTIONIST)) {
        return rejectUnauthorized(callback, ROLE.RECEPTIONIST)
      }
      const sessions = getAllSessions()
      callback({ success: true, sessions })
    })
    
    // Add a new session
    socket.on('session:add', (callback) => {
      if (!isAuthorized(socket, ROLE.RECEPTIONIST)) {
        return rejectUnauthorized(callback, ROLE.RECEPTIONIST)
      }
      const newSession = addSession()
      callback({ success: true, session: newSession })
      // Broadcast that the next race queue has changed
      io.emit('nextRace:changed')
    })
    
    // Add a driver to a session
    socket.on('driver:add', (data, callback) => {
      if (!isAuthorized(socket, ROLE.RECEPTIONIST)) {
        return rejectUnauthorized(callback, ROLE.RECEPTIONIST)
      }
      const { sessionId, driverName, carNumber } = data
      const result = addDriver(sessionId, driverName, carNumber)
      callback(result)
      // Broadcast if driver was added successfully
      if (result.success) {
        io.emit('nextRace:changed')
      }
    })
    
    // Remove a session
    socket.on('session:remove', (data, callback) => {
      if (!isAuthorized(socket, ROLE.RECEPTIONIST)) {
        return rejectUnauthorized(callback, ROLE.RECEPTIONIST)
      }
      const { sessionId } = data
      const result = removeSession(sessionId)
      callback(result)
      // Broadcast if session was removed successfully
      if (result.success) {
        io.emit('nextRace:changed')
      }
    })
    
    // Remove a driver from a session
    socket.on('driver:remove', (data, callback) => {
      if (!isAuthorized(socket, ROLE.RECEPTIONIST)) {
        return rejectUnauthorized(callback, ROLE.RECEPTIONIST)
      }
      const { sessionId, driverName } = data
      const result = removeDriver(sessionId, driverName)
      callback(result)
      // Broadcast if driver was removed successfully
      if (result.success) {
        io.emit('nextRace:changed')
      }
    })
    
    // Update a driver in a session
    socket.on('driver:update', (data, callback) => {
      if (!isAuthorized(socket, ROLE.RECEPTIONIST)) {
        return rejectUnauthorized(callback, ROLE.RECEPTIONIST)
      }
      const { sessionId, carNumber, newDriverName } = data
      const result = updateDriver(sessionId, carNumber, newDriverName)
      callback(result)
      // Broadcast if driver was updated successfully
      if (result.success) {
        io.emit('nextRace:changed')
      }
    })
    
    // Authenticate receptionist
    socket.on('auth:receptionist', (data, callback) => {
      if (typeof callback !== 'function') {
        return
      }

      callback({
        success: false,
        error: 'Deprecated. Authenticate in Socket.IO handshake via auth.role and auth.accessKey.'
      })
    })
    
    // Authenticate safety official
    socket.on('auth:safety', (data, callback) => {
      if (typeof callback !== 'function') {
        return
      }

      callback({
        success: false,
        error: 'Deprecated. Authenticate in Socket.IO handshake via auth.role and auth.accessKey.'
      })
    })
    
    // Authenticate lap-line observer
    socket.on('auth:observer', (data, callback) => {
      if (typeof callback !== 'function') {
        return
      }

      callback({
        success: false,
        error: 'Deprecated. Authenticate in Socket.IO handshake via auth.role and auth.accessKey.'
      })
    })
    
    // Get the next race session
    socket.on('getNextRace', (callback) => {
      const result = getNextRaceSession()
      callback(result)
    })
    
    // Start a race
    socket.on('race:start', (data, callbackParam) => {
      const callback = typeof callbackParam === 'function'
        ? callbackParam
        : (typeof data === 'function' ? data : undefined)

      if (!isAuthorized(socket, ROLE.SAFETY)) {
        return rejectUnauthorized(callback, ROLE.SAFETY)
      }

      // Handle both old format (no data) and new format (with sessionId)
      let sessionId = null
      let raceStartCallback = callback || (() => {})
      
      // If data is a function, it's the callback (old format with no sessionId)
      if (typeof data === 'function') {
        raceStartCallback = data
        // Auto-select first session if no sessionId provided
        const sessions = getAllSessions()
        if (sessions.length > 0) {
          sessionId = sessions[0].id
        } else {
          return raceStartCallback({ success: false, error: 'No sessions available to start' })
        }
      } else if (data && data.sessionId) {
        sessionId = data.sessionId
      } else {
        // No sessionId provided, auto-select first
        const sessions = getAllSessions()
        if (sessions.length > 0) {
          sessionId = sessions[0].id
        } else {
          return raceStartCallback({ success: false, error: 'No sessions available to start' })
        }
      }
      
      const result = startRace(sessionId)
      raceStartCallback(result)
      // Broadcast if race started successfully (next race in queue changes)
      if (result.success) {
        io.emit('race:started', { sessionId })
        io.emit('nextRace:changed')
        broadcastState(io)
      }
    })
    
    // Change race mode (accepts both race:changeMode and race:mode:set for compatibility)
    socket.on('race:changeMode', (data = {}, callback = () => {}) => {
      if (!isAuthorized(socket, ROLE.SAFETY)) {
        return rejectUnauthorized(callback, ROLE.SAFETY)
      }

      if (!data.mode) {
        return callback({ success: false, error: 'Mode required' })
      }
      
      // Convert mode to lowercase for internal use
      const mode = data.mode.toLowerCase()
      const result = changeRaceMode(mode)
      
      if (result.success) {
        broadcastState(io)
      }
      
      callback(result)
    })
    
    // Legacy event name support (race:mode:set) - frontend uses this
    socket.on('race:mode:set', (mode, callback = () => {}) => {
      if (!isAuthorized(socket, ROLE.SAFETY)) {
        return rejectUnauthorized(callback, ROLE.SAFETY)
      }

      if (!mode) {
        return callback({ success: false, error: 'Mode required' })
      }
      
      // Convert mode to lowercase for internal use
      const modeLower = mode.toLowerCase()
      const result = changeRaceMode(modeLower)
      
      if (result.success) {
        broadcastState(io)
      }
      
      callback(result)
    })
    
    // End race session (after cars return to pit lane)
    socket.on('session:end', (callback = () => {}) => {
      if (!isAuthorized(socket, ROLE.SAFETY)) {
        return rejectUnauthorized(callback, ROLE.SAFETY)
      }

      const result = endSession()
      
      if (result.success) {
        io.emit('nextRace:changed')
      }
      
      callback(result)
    })
    
    // Legacy event name support (race:endSession) - frontend uses this
    socket.on('race:endSession', (callback = () => {}) => {
      if (!isAuthorized(socket, ROLE.SAFETY)) {
        return rejectUnauthorized(callback, ROLE.SAFETY)
      }

      const result = endSession()
      
      if (result.success) {
        io.emit('nextRace:changed')
        broadcastState(io)
      }
      
      callback(result)
    })
    
    // Get current race status
    socket.on('getRaceStatus', (callback) => {
      const result = getCurrentRaceStatus()
      callback(result)
    })
    
    // Record lap crossing
    socket.on('lap:crossing', (data, callback) => {
      if (!isAuthorized(socket, ROLE.OBSERVER)) {
        return rejectUnauthorized(callback, ROLE.OBSERVER)
      }

      const { carNumber, timestamp } = data
      const result = recordLapCrossing(carNumber, timestamp)
      callback(result)
    })
    
    // Get leaderboard
    socket.on('getLeaderboard', (callback) => {
      const result = getLeaderboard()
      callback(result)
    })
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })
}

module.exports = initializeSocketHandlers

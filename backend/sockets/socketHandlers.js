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

/**
 * Broadcast current race state to all connected clients
 * Emits state:update event with race mode and timer information
 */
function broadcastState(io) {
  const result = getCurrentRaceStatus()

  if (!result.success) {
    io.emit("state:update", {
      raceMode: "danger",
      timer: { running: false }
    })
    return
  }
  
  const race = result.race
  console.log("BROADCAST:", race.mode)

  io.emit("state:update", {
    raceMode: race.mode,
    timer: {
      running: race.mode !== "finished",
      endsAt: race.startTime + result.race.totalDuration * 1000
    }
  })

  const now = Date.now()

  if (race.startTime && now >= race.startTime + result.race.totalDuration * 1000) {
    changeRaceMode("finished")
  }
}

/**
 * Initialize Socket.IO event handlers
 */
function initializeSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)
    
    // Get all sessions
    socket.on('getSessions', (callback) => {
      const sessions = getAllSessions()
      callback({ success: true, sessions })
    })
    
    // Add a new session
    socket.on('session:add', (callback) => {
      const newSession = addSession()
      callback({ success: true, session: newSession })
      // Broadcast that the next race queue has changed
      io.emit('nextRace:changed')
    })
    
    // Add a driver to a session
    socket.on('driver:add', (data, callback) => {
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
      const { sessionId, carNumber, newDriverName } = data
      const result = updateDriver(sessionId, carNumber, newDriverName)
      callback(result)
      // Broadcast if driver was updated successfully
      if (result.success) {
        io.emit('nextRace:changed')
      }
    })
    
    // Authenticate receptionist
    socket.on('auth:receptionist', async (data, callback) => {
      const { accessKey } = data
      const result = await authenticateReceptionist(accessKey)
      callback(result)
    })
    
    // Authenticate safety official
    socket.on('auth:safety', async (data, callback) => {
      const { accessKey } = data
      const result = await authenticateSafety(accessKey)
      callback(result)
    })
    
    // Authenticate lap-line observer
    socket.on('auth:observer', async (data, callback) => {
      const { accessKey } = data
      const result = await authenticateObserver(accessKey)
      callback(result)
    })
    
    // Get the next race session
    socket.on('getNextRace', (callback) => {
      const result = getNextRaceSession()
      callback(result)
    })
    
    // Start a race
    socket.on('race:start', (data, callback) => {
      const { sessionId } = data
      const result = startRace(sessionId)
      callback(result)
      // Broadcast if race started successfully (next race in queue changes)
      if (result.success) {
        io.emit('race:started', { sessionId })
        io.emit('nextRace:changed')
        broadcastState(io)
      }
    })
    
    // Change race mode
    socket.on('race:changeMode', (data = {}, callback = () => {}) => {
      if (!data.mode) {
        return callback({ success: false, error: 'Mode required' })
      }
      
      const { mode } = data
      const result = changeRaceMode(mode)
      
      if (result.success) {
        broadcastState(io)
      }
      
      callback(result)
    })
    
    // End race session (after cars return to pit lane)
    socket.on('session:end', (callback = () => {}) => {
      const result = endSession()
      
      if (result.success) {
        io.emit('nextRace:changed')
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

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
  getNextRaceSession,
  startRace,
  changeRaceMode,
  getCurrentRaceStatus,
  recordLapCrossing,
  getLeaderboard
} = require('../state/raceState')

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
      const { sessionId, driverName } = data
      const result = addDriver(sessionId, driverName)
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
        io.emit('nextRace:changed')
      }
    })
    
    // Change race mode
    socket.on('race:changeMode', (data, callback) => {
      const { mode } = data
      const result = changeRaceMode(mode)
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

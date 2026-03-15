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
  getNextRaceSession,
  startRace,
  changeRaceMode
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
    })
    
    // Add a driver to a session
    socket.on('driver:add', (data, callback) => {
      const { sessionId, driverName } = data
      const result = addDriver(sessionId, driverName)
      callback(result)
    })
    
    // Remove a session
    socket.on('session:remove', (data, callback) => {
      const { sessionId } = data
      const result = removeSession(sessionId)
      callback(result)
    })
    
    // Remove a driver from a session
    socket.on('driver:remove', (data, callback) => {
      const { sessionId, driverName } = data
      const result = removeDriver(sessionId, driverName)
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
    })
    
    // Change race mode
    socket.on('race:changeMode', (data, callback) => {
      const { mode } = data
      const result = changeRaceMode(mode)
      callback(result)
    })
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })
}

module.exports = initializeSocketHandlers

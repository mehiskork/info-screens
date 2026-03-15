/**
 * Socket.IO Event Handlers
 * Step-by-step implementation
 */

const { 
  getAllSessions,
  addSession,
  addDriver
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
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })
}

module.exports = initializeSocketHandlers

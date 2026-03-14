/**
 * Socket.IO Event Handlers
 * Step-by-step implementation
 */

const { getAllSessions } = require('../state/raceState')

/**
 * Initialize Socket.IO event handlers
 */
function initializeSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)
    
    // Simple event: Get all sessions
    socket.on('getSessions', (callback) => {
      const sessions = getAllSessions()
      callback({ success: true, sessions })
    })
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })
}

module.exports = initializeSocketHandlers

const express = require('express')
const http = require('http')
const { Server } = require('socket.io')

const { PORT, IS_DEV } = require('./config/settings')
const initializeSocketHandlers = require('./sockets/socketHandlers')

console.log(`Running in ${IS_DEV ? 'development' : 'production'} mode`)

const app = express()
const server = http.createServer(app)
const io = new Server(server)

// Serve static files
app.use(express.static('public'))

// Initialize Socket.IO event handlers
initializeSocketHandlers(io)

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
  console.log(`Socket.IO ready for connections`)
})
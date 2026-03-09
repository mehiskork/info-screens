const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
require('dotenv').config()

// Check if we're in development mode based on an environment variable
const isDev = process.env.DEV === 'true'
const RACE_DURATION = isDev ? 60 : 600 // seconds, shorter in development for faster testing

if (isDev) {
  console.log('Running in development mode')
} else {
  console.log('Running in production mode')
}

// Ensure that the required access keys are set in the environment variables
if (!process.env.RECEPTIONIST_KEY || !process.env.OBSERVER_KEY || !process.env.SAFETY_KEY) {
  console.error('Error: access keys not set. Check your .env file.')
  process.exit(1)
}

const app = express()
const server = http.createServer(app)      // pass the Express app to createServer
const io = new Server(server)              // pass the HTTP server to Socket.IO

app.use(express.static('public'))

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id)
  socket.emit('hello', { message: 'Server is alive!' })
})

server.listen(3000, () => {
  console.log('listening on http://localhost:3000')
})
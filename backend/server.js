const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const path = require('path')

const { PORT, IS_DEV } = require('./config/settings')
const initializeSocketHandlers = require('./sockets/socketHandlers')

console.log(`Running in ${IS_DEV ? 'development' : 'production'} mode`)

const app = express()
const server = http.createServer(app)
const io = new Server(server)

// Serve static files
app.use(express.static('public'))

// Serve frontend files from parent directory
app.use('/frontend', express.static('../frontend'))

// Serve leaderboard assets from a backend-owned first-level route
app.use('/leader-board', express.static(path.join(__dirname, '../frontend/leaderboard'), { index: false }))

// Routes for frontend interfaces
app.get('/front-desk', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/front-desk/index.html'))
})

app.get('/next-race', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/next-race/index.html'))
})

app.get('/race-control', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/race-control/race-control-index.html'))
})

app.get('/race-countdown', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/race-countdown/race-countdown-index.html'))
})

app.get('/race-flags', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/race-flags/race-flags-index.html'))
})

app.get('/lap-line-tracker', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/lap-line-tracker/lap-tracker-index.html'))
})

app.get(['/leader-board', '/leader-board/'], (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/leaderboard/leaderboard-index.html'))
})

// Initialize Socket.IO event handlers
initializeSocketHandlers(io)

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
  console.log(`Socket.IO ready for connections`)
})


const express = require('express')
const http = require('http')
const { Server } = require('socket.io')

const { PORT } = require('./config/settings')
const { IS_DEV } = require('./config/settings')

console.log(`Running in ${IS_DEV ? 'development' : 'production'} mode`)

const app = express()
const server = http.createServer(app)      // pass the Express app to createServer
const io = new Server(server)              // pass the HTTP server to Socket.IO

app.use(express.static('public'))

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id)
  socket.emit('hello', { message: 'Server is alive!' })
})

server.listen(PORT, () => {
  console.log(`listening on http://localhost:${PORT}`)
})
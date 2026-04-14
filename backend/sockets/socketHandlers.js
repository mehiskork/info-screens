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
  getLastFinishedRace,
  recordLapCrossing,
  getLeaderboard
} = require('../state/raceState')
const {
  getAllTimeLeaderboardTopTen,
  getAllTimeLapHistorySummary,
  recordAllTimeLapEntry
} = require('../state/allTimeLapLeaderboard')

const RACE_TICK_MS = 1000
let raceTickHandle = null
let lastBroadcastStateSignature = null

let lightsState = {
  active: false,
  step: 0,
  phase: "idle"
}
let lightsInterval = null



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

function emitLeaderboardUpdated(io) {
  const payload = buildLeaderboardPayload()
  if (!payload) {
    return
  }

  io.emit('leaderboard:updated', payload)
}

function buildLeaderboardPayload() {
  const result = getLeaderboard()
  if (!result.success) {
    return null
  }

  return {
    leaderboard: result.leaderboard,
    hasActiveRace: result.hasActiveRace,
    isFrozenSnapshot: result.isFrozenSnapshot,
    snapshotState: result.snapshotState,
    lapDisplayMode: result.lapDisplayMode,
    source: result.source,
    sessionId: result.sessionId,
    raceMode: result.raceMode
  }
}

function emitAllTimeLeaderboardUpdated(io) {
  const result = getAllTimeLeaderboardTopTen()
  if (result.success) {
    io.emit('allTimeLeaderboard:updated', {
      topTen: result.topTen,
      updatedAt: result.updatedAt
    })
  }
}

function getLifecyclePayload() {
  const raceStatus = getCurrentRaceStatus()
  const leaderboard = getLeaderboard()
  const leaderboardUpdate = buildLeaderboardPayload()
  const lastFinishedRace = getLastFinishedRace()
  const hasActiveRace = Boolean(raceStatus.success)
  const isFrozenSnapshot = !hasActiveRace && Boolean(raceStatus.isFrozenSnapshot || lastFinishedRace.success)
  const snapshotState = hasActiveRace
    ? 'live'
    : (isFrozenSnapshot ? 'post-race-frozen' : 'idle')

  return {
    hasActiveRace,
    isFrozenSnapshot,
    snapshotState,
    raceStatus: hasActiveRace ? raceStatus.race : null,
    leaderboard: leaderboard.success ? leaderboard : null,
    leaderboardUpdate,
    lastFinishedRace: lastFinishedRace.success ? lastFinishedRace.race : null,
    frozenSnapshot: isFrozenSnapshot
      ? {
        race: lastFinishedRace.success ? lastFinishedRace.race : null,
        leaderboard: leaderboardUpdate ? leaderboardUpdate.leaderboard : null,
        lapDisplayMode: 'completedLaps'
      }
      : null
  }
}

function emitLifecycle(io) {
  io.emit('race:lifecycle', getLifecyclePayload())
}

function emitRaceStatus(io, options = {}) {
  const { includeLifecycle = true } = options
  const result = getCurrentRaceStatus()
  const lastFinishedRace = getLastFinishedRace()
  const isFrozenSnapshot = Boolean(result.isFrozenSnapshot || lastFinishedRace.success)
  const snapshotState = result.success
    ? 'live'
    : (isFrozenSnapshot ? 'post-race-frozen' : 'idle')

  if (!result.success) {
    io.emit('race:status', {
      active: false,
      mode: 'danger',
      timer: { running: false },
      isFrozenSnapshot,
      snapshotState,
      secondsRemaining: 0,
      lastFinishedRace: lastFinishedRace.success ? lastFinishedRace.race : null
    })
    if (includeLifecycle) {
      emitLifecycle(io)
    }
    return
  }

  const race = result.race
  io.emit('race:status', {
    active: true,
    isFrozenSnapshot: false,
    snapshotState,
    sessionId: race.sessionId,
    mode: race.mode,
    secondsRemaining: race.secondsRemaining,
    totalDuration: race.totalDuration,
    startTime: race.startTime,
    lastFinishedRace: lastFinishedRace.success ? lastFinishedRace.race : null
  })

  if (includeLifecycle) {
    emitLifecycle(io)
  }
}


function emitRaceSnapshot(socket) {
  socket.emit('race:statusSnapshot', {
    ...getLifecyclePayload(),

    lights: lightsState
  })

  const allTimeResult = getAllTimeLeaderboardTopTen()
  if (allTimeResult.success) {
    socket.emit('allTimeLeaderboard:snapshot', {
      topTen: allTimeResult.topTen,
      updatedAt: allTimeResult.updatedAt
    })
  }
}

function logBroadcastStateChange(payload) {
  const signature = JSON.stringify({
    raceMode: payload.raceMode,
    hasActiveRace: payload.hasActiveRace,
    sessionId: payload.sessionId || null,
    timerRunning: Boolean(payload.timer?.running),
    endsAt: payload.timer?.endsAt || null
  })

  if (signature === lastBroadcastStateSignature) {
    return
  }

  lastBroadcastStateSignature = signature
  console.log('Broadcast state changed:', payload)
}

/**
 * Broadcast current race state to all connected clients
 * Emits state:update event with race mode and timer information
 */
function broadcastState(io) {
  const result = getCurrentRaceStatus()

  if (!result.success) {
    const payload = {
      raceMode: "DANGER",
      timer: { running: false },
      hasActiveRace: false
    }

    io.emit("state:update", payload)
    logBroadcastStateChange(payload)
    emitRaceStatus(io, { includeLifecycle: false })
    return
  }

  const race = result.race

  const now = Date.now()

  if (race.mode !== 'finish' && race.startTime && now >= race.startTime + result.race.totalDuration * 1000) {
    const finishResult = changeRaceMode('finish')
    if (finishResult.success) {
      io.emit('race:modeChanged', { mode: 'finish' })
      io.emit('race:finished', { sessionId: race.sessionId, reason: 'timer-expired' })
    }
  }

  const updatedStatus = getCurrentRaceStatus()
  if (updatedStatus.success) {
    const payload = {
      raceMode: updatedStatus.race.mode.toUpperCase(),
      timer: {
        running: updatedStatus.race.mode !== "finish",
        endsAt: updatedStatus.race.startTime + updatedStatus.race.totalDuration * 1000
      },
      hasActiveRace: true,
      sessionId: updatedStatus.race.sessionId
    }

    io.emit("state:update", payload)
    logBroadcastStateChange(payload)
  }

  emitRaceStatus(io, { includeLifecycle: false })
}

function startRaceLifecycleTick(io) {
  if (raceTickHandle) {
    return
  }

  raceTickHandle = setInterval(() => {
    broadcastState(io)
  }, RACE_TICK_MS)
}

/**
 * Initialize Socket.IO event handlers
 */
function initializeSocketHandlers(io) {
  startRaceLifecycleTick(io)

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
    emitRaceSnapshot(socket)

    // Get all sessions
    socket.on('getSessions', (callback) => {
      if (!isAuthorized(socket, ROLE.RECEPTIONIST)) {
        return rejectUnauthorized(callback, ROLE.RECEPTIONIST)
      }
      const sessions = getAllSessions()
      callback({ success: true, sessions })
    })

    socket.on('allTimeLeaderboard:get', (callback = () => { }) => {
      const result = getAllTimeLeaderboardTopTen()
      callback(result)
    })

    socket.on('allTimeLeaderboard:historySummary:get', (callback = () => { }) => {
      const result = getAllTimeLapHistorySummary()
      callback(result)
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

    // START LIGHTS EVENTS


    socket.on("startLights:begin", (callback) => {

      if (!isAuthorized(socket, ROLE.SAFETY)) {
        return rejectUnauthorized(callback, ROLE.SAFETY)
      }

      if (lightsInterval) {
        clearInterval(lightsInterval)
        lightsInterval = null
      }

      lightsState = {
        active: true,
        step: 0,
        phase: "counting"
      }

      io.emit("startLights:begin")

      lightsInterval = setInterval(() => {
        if (lightsState.step < 5) {
          lightsState.step++
          io.emit("startLights:step", lightsState.step)
        } else {
          clearInterval(lightsInterval)
          lightsInterval = null
        }
      }, 1000)
    })

    socket.on("startLights:go", (callback) => {

      if (!isAuthorized(socket, ROLE.SAFETY)) {
        return rejectUnauthorized(callback, ROLE.SAFETY)
      }

      if (!lightsState.active) return

      if (lightsInterval) {
        clearInterval(lightsInterval)
        lightsInterval = null
      }

      lightsState.phase = "go"

      io.emit("startLights:go")

      // reset after short delay
      setTimeout(() => {
        lightsState = { active: false, step: 0, phase: "idle" }
      }, 3000)
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
      let raceStartCallback = callback || (() => { })

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
        io.emit('race:modeChanged', { mode: 'safe' })
        io.emit('nextRace:changed')
        emitRaceStatus(io)
        emitLeaderboardUpdated(io)
        broadcastState(io)
      }
    })

    // Change race mode (accepts both race:changeMode and race:mode:set for compatibility)
    socket.on('race:changeMode', (data = {}, callback = () => { }) => {
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
        io.emit('race:modeChanged', { mode })
        if (mode === 'finish') {
          const raceStatus = getCurrentRaceStatus()
          io.emit('race:finished', {
            sessionId: raceStatus.success ? raceStatus.race.sessionId : null,
            reason: 'manual'
          })
        }
        emitRaceStatus(io)
        broadcastState(io)
      }

      callback(result)
    })

    // Legacy event name support (race:mode:set) - frontend uses this
    socket.on('race:mode:set', (mode, callback = () => { }) => {
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
        io.emit('race:modeChanged', { mode: modeLower })
        if (modeLower === 'finish') {
          const raceStatus = getCurrentRaceStatus()
          io.emit('race:finished', {
            sessionId: raceStatus.success ? raceStatus.race.sessionId : null,
            reason: 'manual'
          })
        }
        emitRaceStatus(io)
        broadcastState(io)
      }

      callback(result)
    })

    // End race session (after cars return to pit lane)
    socket.on('session:end', (callback = () => { }) => {
      if (!isAuthorized(socket, ROLE.SAFETY)) {
        return rejectUnauthorized(callback, ROLE.SAFETY)
      }

      const raceStatusBeforeEnd = getCurrentRaceStatus()
      const endedSessionId = raceStatusBeforeEnd.success ? raceStatusBeforeEnd.race.sessionId : null
      const result = endSession()

      if (result.success) {
        io.emit('race:sessionEnded', {
          sessionId: endedSessionId,
          endedAt: Date.now(),
          source: 'session:end'
        })
        io.emit('nextRace:changed')
        emitRaceStatus(io)
        emitLeaderboardUpdated(io)
        broadcastState(io)
      }

      callback(result)
    })

    // Legacy event name support (race:endSession) - frontend uses this
    socket.on('race:endSession', (callback = () => { }) => {
      if (!isAuthorized(socket, ROLE.SAFETY)) {
        return rejectUnauthorized(callback, ROLE.SAFETY)
      }

      const raceStatusBeforeEnd = getCurrentRaceStatus()
      const endedSessionId = raceStatusBeforeEnd.success ? raceStatusBeforeEnd.race.sessionId : null
      const result = endSession()

      if (result.success) {
        io.emit('race:sessionEnded', {
          sessionId: endedSessionId,
          endedAt: Date.now(),
          source: 'race:endSession'
        })
        io.emit('nextRace:changed')
        emitRaceStatus(io)
        emitLeaderboardUpdated(io)
        broadcastState(io)
      }

      callback(result)
    })

    // Get current race status
    socket.on('getRaceStatus', (callback) => {
      const result = getCurrentRaceStatus()
      callback(result)
    })

    socket.on('getRaceLifecycle', (callback = () => { }) => {
      callback({ success: true, ...getLifecyclePayload() })
    })

    // Record lap crossing
    socket.on('lap:crossing', (data, callback) => {
      if (!isAuthorized(socket, ROLE.OBSERVER)) {
        return rejectUnauthorized(callback, ROLE.OBSERVER)
      }

      const { carNumber, timestamp } = data
      const result = recordLapCrossing(carNumber, timestamp)
      callback(result)

      if (result.success) {
        const raceStatus = getCurrentRaceStatus()
        if (raceStatus.success) {
          const driver = (raceStatus.race.drivers || []).find((item) => item.carNumber === carNumber)
          if (driver && Number.isFinite(result.lapTime) && result.lapTime > 0) {
            const allTimeInsert = recordAllTimeLapEntry({
              driverName: driver.name,
              carNumber,
              lapTime: result.lapTime,
              recordedAt: timestamp || Date.now(),
              sessionId: raceStatus.race.sessionId
            })

            if (allTimeInsert.success && allTimeInsert.topTenChanged) {
              emitAllTimeLeaderboardUpdated(io)
            }
          }
        }

        io.emit('lap:recorded', {
          carNumber,
          timestamp: timestamp || Date.now(),
          lap: result.lap,
          lapTime: result.lapTime || null,
          bestTime: result.bestTime || null
        })
        emitLeaderboardUpdated(io)
        emitLifecycle(io)
      }
    })

    // Get leaderboard
    socket.on('getLeaderboard', (callback) => {
      const result = getLeaderboard()
      callback(result)
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)

      if (lightsInterval) {
        clearInterval(lightsInterval)
        lightsInterval = null
        lightsRunning = false
      }
    })
  })
}

module.exports = initializeSocketHandlers

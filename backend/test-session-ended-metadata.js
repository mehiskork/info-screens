const io = require('socket.io-client')

const BASE_URL = process.env.SOCKET_URL || 'http://localhost:3000'
const receptionistKey = process.env.RECEPTIONIST_KEY || 'receptionist123'
const safetyKey = process.env.SAFETY_KEY || 'safety123'

const receptionistSocket = io(BASE_URL, {
  auth: {
    role: 'receptionist',
    accessKey: receptionistKey
  }
})

const safetySocket = io(BASE_URL, {
  auth: {
    role: 'safety',
    accessKey: safetyKey
  }
})

function waitForConnect(socket, label) {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve()
      return
    }

    socket.once('connect', resolve)
    socket.once('connect_error', (error) => {
      reject(new Error(`${label} connection failed: ${error.message}`))
    })
  })
}

function emitAck(socket, eventName, data) {
  return new Promise((resolve) => {
    if (typeof data === 'undefined') {
      socket.emit(eventName, resolve)
      return
    }

    socket.emit(eventName, data, resolve)
  })
}

function waitForEvent(socket, eventName, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, onEvent)
      reject(new Error(`Timed out waiting for ${eventName}`))
    }, timeoutMs)

    function onEvent(payload) {
      clearTimeout(timeout)
      resolve(payload)
    }

    socket.once(eventName, onEvent)
  })
}

async function prepareCleanState() {
  console.log('0. Preparing clean state...')

  const raceStatus = await emitAck(receptionistSocket, 'getRaceStatus')
  if (raceStatus.success) {
    await emitAck(safetySocket, 'race:changeMode', { mode: 'finish' })
    const endResult = await emitAck(safetySocket, 'session:end')
    if (!endResult.success) {
      throw new Error(`Failed to clear active race: ${endResult.error}`)
    }
  }

  const sessionsResponse = await emitAck(receptionistSocket, 'getSessions')
  if (!sessionsResponse.success) {
    throw new Error(`Failed to fetch queued sessions: ${sessionsResponse.error}`)
  }

  for (const session of sessionsResponse.sessions) {
    const removeResult = await emitAck(receptionistSocket, 'session:remove', { sessionId: session.id })
    if (!removeResult.success) {
      throw new Error(`Failed to remove queued session ${session.id}: ${removeResult.error}`)
    }
  }

  console.log('  ✓ Clean state ready\n')
}

async function createRaceSession(driverName, carNumber) {
  const sessionResponse = await emitAck(receptionistSocket, 'session:add')
  if (!sessionResponse.success) {
    throw new Error(`Failed to create session: ${sessionResponse.error}`)
  }

  const sessionId = sessionResponse.session.id
  const driverResponse = await emitAck(receptionistSocket, 'driver:add', {
    sessionId,
    driverName,
    carNumber
  })

  if (!driverResponse.success) {
    throw new Error(`Failed to add driver: ${driverResponse.error}`)
  }

  const startResponse = await emitAck(safetySocket, 'race:start', { sessionId })
  if (!startResponse.success) {
    throw new Error(`Failed to start race ${sessionId}: ${startResponse.error}`)
  }

  const finishResponse = await emitAck(safetySocket, 'race:changeMode', { mode: 'finish' })
  if (!finishResponse.success) {
    throw new Error(`Failed to finish race ${sessionId}: ${finishResponse.error}`)
  }

  return sessionId
}

async function verifySessionEndedPayload(triggerEventName, driverName, carNumber) {
  console.log(`1. Verifying ${triggerEventName} payload...`)
  const sessionId = await createRaceSession(driverName, carNumber)
  const eventPromise = waitForEvent(safetySocket, 'race:sessionEnded')

  const endResponse = await emitAck(safetySocket, triggerEventName)
  if (!endResponse.success) {
    throw new Error(`${triggerEventName} failed: ${endResponse.error}`)
  }

  const payload = await eventPromise
  if (payload.sessionId !== sessionId) {
    throw new Error(`Expected sessionId ${sessionId}, got ${payload.sessionId}`)
  }

  if (typeof payload.endedAt !== 'number' || Number.isNaN(payload.endedAt)) {
    throw new Error(`Expected numeric endedAt, got ${payload.endedAt}`)
  }

  if (payload.source !== triggerEventName) {
    throw new Error(`Expected source ${triggerEventName}, got ${payload.source}`)
  }

  const raceStatus = await emitAck(receptionistSocket, 'getRaceStatus')
  if (raceStatus.success) {
    throw new Error('Expected no active race after ending session')
  }

  console.log(`  ✓ sessionId = ${payload.sessionId}`)
  console.log(`  ✓ endedAt = ${payload.endedAt}`)
  console.log(`  ✓ source = ${payload.source}\n`)
}

async function run() {
  try {
    await Promise.all([
      waitForConnect(receptionistSocket, 'Receptionist'),
      waitForConnect(safetySocket, 'Safety')
    ])

    console.log('✓ Connected as receptionist and safety\n')
    console.log('=== Session Ended Metadata Tests ===\n')

    await prepareCleanState()
    await verifySessionEndedPayload('session:end', 'Alice', 1)
    await verifySessionEndedPayload('race:endSession', 'Bob', 2)

    console.log('=== All session-ended metadata tests passed! ===')
    receptionistSocket.disconnect()
    safetySocket.disconnect()
    process.exit(0)
  } catch (error) {
    console.error(`✗ ${error.message}`)
    receptionistSocket.disconnect()
    safetySocket.disconnect()
    process.exit(1)
  }
}

run()
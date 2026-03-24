// Test script for RT38: Queue accuracy and driver sorting
const io = require('socket.io-client')

const socket = io('http://localhost:3000')

let session1Id = null
let session2Id = null

socket.on('connect', () => {
  console.log('✓ Connected to server\n')
  runTests()
})

socket.on('connect_error', (error) => {
  console.error('✗ Connection failed:', error.message)
  process.exit(1)
})

async function runTests() {
  console.log('=== RT38 Queue Accuracy and Driver Sorting Tests ===\n')
  
  // Step 1: Create two sessions
  console.log('1. Creating Session 1 and Session 2...')
  socket.emit('session:add', (r1) => {
    session1Id = r1.session.id
    console.log(`  ✓ Session ${session1Id} created`)
    
    socket.emit('session:add', (r2) => {
      session2Id = r2.session.id
      console.log(`  ✓ Session ${session2Id} created\n`)
      
      setTimeout(() => testGetSessionsBeforeRace(), 100)
    })
  })
}

function testGetSessionsBeforeRace() {
  console.log('2. Testing getSessions BEFORE any race starts...')
  socket.emit('getSessions', (response) => {
    if (response.success && response.sessions.length === 2) {
      console.log(`  ✓ getSessions returns both sessions (${response.sessions.map(s => s.id).join(', ')})`)
      console.log(`  ✓ Queue length: ${response.sessions.length}\n`)
      
      setTimeout(() => addDriversToSession1(), 100)
    } else {
      console.error('  ✗ Expected 2 sessions, got:', response)
      process.exit(1)
    }
  })
}

function addDriversToSession1() {
  console.log('3. Adding drivers to Session 1 in MIXED order (6, 2, 8, 1)...')
  
  // Add in intentionally mixed order
  socket.emit('driver:add', { sessionId: session1Id, driverName: 'Driver F', carNumber: 6 }, (r) => {
    if (r.success) console.log(`  ✓ Driver F added with car 6`)
  })
  
  setTimeout(() => {
    socket.emit('driver:add', { sessionId: session1Id, driverName: 'Driver B', carNumber: 2 }, (r) => {
      if (r.success) console.log(`  ✓ Driver B added with car 2`)
    })
  }, 50)
  
  setTimeout(() => {
    socket.emit('driver:add', { sessionId: session1Id, driverName: 'Driver H', carNumber: 8 }, (r) => {
      if (r.success) console.log(`  ✓ Driver H added with car 8`)
    })
  }, 100)
  
  setTimeout(() => {
    socket.emit('driver:add', { sessionId: session1Id, driverName: 'Driver A', carNumber: 1 }, (r) => {
      if (r.success) {
        console.log(`  ✓ Driver A added with car 1\n`)
        setTimeout(() => verifyDriverSortingBeforeRace(), 200)
      }
    })
  }, 150)
}

function verifyDriverSortingBeforeRace() {
  console.log('4. Verifying driver sorting in getSessions...')
  socket.emit('getSessions', (response) => {
    if (!response.success) {
      console.error('  ✗ Failed to get sessions:', response)
      process.exit(1)
    }
    
    const session1 = response.sessions.find(s => s.id === session1Id)
    if (!session1) {
      console.error('  ✗ Session 1 not found in response')
      process.exit(1)
    }
    
    const carNumbers = session1.drivers.map(d => d.carNumber)
    const expectedOrder = [1, 2, 6, 8]
    
    if (JSON.stringify(carNumbers) === JSON.stringify(expectedOrder)) {
      console.log(`  ✓ Drivers sorted correctly: ${carNumbers.join(', ')}`)
      console.log(`  ✓ Driver names in order: ${session1.drivers.map(d => d.name).join(', ')}\n`)
      
      setTimeout(() => startRaceSession1(), 100)
    } else {
      console.error(`  ✗ Expected order [1, 2, 6, 8], got [${carNumbers.join(', ')}]`)
      process.exit(1)
    }
  })
}

function startRaceSession1() {
  console.log('5. Starting race for Session 1...')
  socket.emit('race:start', { sessionId: session1Id }, (response) => {
    if (response.success) {
      console.log(`  ✓ Race started for Session ${session1Id}\n`)
      
      setTimeout(() => testGetSessionsAfterRace(), 100)
    } else {
      console.error('  ✗ Failed to start race:', response.error)
      process.exit(1)
    }
  })
}

function testGetSessionsAfterRace() {
  console.log('6. Testing getSessions AFTER race starts (critical test)...')
  socket.emit('getSessions', (response) => {
    if (!response.success) {
      console.error('  ✗ Failed to get sessions:', response)
      process.exit(1)
    }
    
    const sessionIds = response.sessions.map(s => s.id)
    
    if (response.sessions.length === 1 && sessionIds[0] === session2Id) {
      console.log(`  ✓ getSessions returns ONLY Session ${session2Id}`)
      console.log(`  ✓ Active Session ${session1Id} is filtered out`)
      console.log(`  ✓ Queue length: ${response.sessions.length}\n`)
      
      setTimeout(() => addDriversToSession2(), 100)
    } else {
      console.error(`  ✗ Expected only Session ${session2Id}, got:`, sessionIds)
      console.error('  ✗ Active session was NOT filtered out!')
      process.exit(1)
    }
  })
}

function addDriversToSession2() {
  console.log('7. Adding drivers to Session 2 in MIXED order (5, 3, 7, 4)...')
  
  socket.emit('driver:add', { sessionId: session2Id, driverName: 'Driver E', carNumber: 5 }, (r) => {
    if (r.success) console.log(`  ✓ Driver E added with car 5`)
  })
  
  setTimeout(() => {
    socket.emit('driver:add', { sessionId: session2Id, driverName: 'Driver C', carNumber: 3 }, (r) => {
      if (r.success) console.log(`  ✓ Driver C added with car 3`)
    })
  }, 50)
  
  setTimeout(() => {
    socket.emit('driver:add', { sessionId: session2Id, driverName: 'Driver G', carNumber: 7 }, (r) => {
      if (r.success) console.log(`  ✓ Driver G added with car 7`)
    })
  }, 100)
  
  setTimeout(() => {
    socket.emit('driver:add', { sessionId: session2Id, driverName: 'Driver D', carNumber: 4 }, (r) => {
      if (r.success) {
        console.log(`  ✓ Driver D added with car 4\n`)
        setTimeout(() => verifySession2Sorting(), 200)
      }
    })
  }, 150)
}

function verifySession2Sorting() {
  console.log('8. Verifying Session 2 driver sorting...')
  socket.emit('getSessions', (response) => {
    if (!response.success || response.sessions.length !== 1) {
      console.error('  ✗ Unexpected response:', response)
      process.exit(1)
    }
    
    const session2 = response.sessions[0]
    const carNumbers = session2.drivers.map(d => d.carNumber)
    const expectedOrder = [3, 4, 5, 7]
    
    if (JSON.stringify(carNumbers) === JSON.stringify(expectedOrder)) {
      console.log(`  ✓ Drivers sorted correctly: ${carNumbers.join(', ')}`)
      console.log(`  ✓ Driver names in order: ${session2.drivers.map(d => d.name).join(', ')}\n`)
      
      setTimeout(() => testGetNextRace(), 100)
    } else {
      console.error(`  ✗ Expected order [3, 4, 5, 7], got [${carNumbers.join(', ')}]`)
      process.exit(1)
    }
  })
}

function testGetNextRace() {
  console.log('9. Testing getNextRace also returns sorted drivers...')
  socket.emit('getNextRace', (response) => {
    if (!response.success) {
      console.error('  ✗ Failed to get next race:', response)
      process.exit(1)
    }
    
    const carNumbers = response.data.drivers.map(d => d.carNumber)
    const expectedOrder = [3, 4, 5, 7]
    
    if (JSON.stringify(carNumbers) === JSON.stringify(expectedOrder)) {
      console.log(`  ✓ getNextRace returns sorted drivers: ${carNumbers.join(', ')}`)
      console.log(`  ✓ Session ID: ${response.data.id}\n`)
      
      finalVerification()
    } else {
      console.error(`  ✗ Expected order [3, 4, 5, 7], got [${carNumbers.join(', ')}]`)
      process.exit(1)
    }
  })
}

function finalVerification() {
  console.log('=== All RT38 Tests Passed! ===')
  console.log('✓ Active session excluded from getSessions queue')
  console.log('✓ Drivers sorted numerically by carNumber (ascending)')
  console.log('✓ Sorting preserved in all returned session data')
  console.log('✓ Mixed insertion order correctly sorted to numeric order')
  console.log('✓ Frontend will receive correct queue and driver order\n')
  
  socket.disconnect()
  process.exit(0)
}

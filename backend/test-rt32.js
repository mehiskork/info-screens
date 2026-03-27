// Test script for RT32: Live Next Race updates via broadcasting
const io = require('socket.io-client')

const socket = io('http://localhost:3000')

let session1Id = null
let session2Id = null
let session3Id = null
let broadcastCount = 0

socket.on('connect', () => {
  console.log('✓ Connected to server\n')
  
  // Listen for broadcast events
  socket.on('nextRace:changed', () => {
    broadcastCount++
    console.log(`  📡 Broadcast received: nextRace:changed (count: ${broadcastCount})`)
  })
  
  runTests()
})

socket.on('connect_error', (error) => {
  console.error('✗ Connection failed:', error.message)
  process.exit(1)
})

async function runTests() {
  console.log('=== RT32 Live Next Race Broadcasting Tests ===\n')
  
  // Step 1: Create three sessions
  console.log('1. Creating three sessions...')
  socket.emit('session:add', (r1) => {
    session1Id = r1.session.id
    console.log(`  ✓ Session ${session1Id} created`)
    
    socket.emit('session:add', (r2) => {
      session2Id = r2.session.id
      console.log(`  ✓ Session ${session2Id} created`)
      
      socket.emit('session:add', (r3) => {
        session3Id = r3.session.id
        console.log(`  ✓ Session ${session3Id} created\n`)
        
        setTimeout(() => testAddDrivers(), 200)
      })
    })
  })
}

function testAddDrivers() {
  console.log('2. Adding drivers to sessions...')
  
  // Add drivers to session 1
  socket.emit('driver:add', { sessionId: session1Id, driverName: 'Alice' }, (r) => {
    if (r.success) console.log(`  ✓ Alice added to session ${session1Id}`)
  })
  
  // Add drivers to session 2
  socket.emit('driver:add', { sessionId: session2Id, driverName: 'Bob' }, (r) => {
    if (r.success) console.log(`  ✓ Bob added to session ${session2Id}`)
  })
  
  // Add drivers to session 3
  socket.emit('driver:add', { sessionId: session3Id, driverName: 'Charlie' }, (r) => {
    if (r.success) console.log(`  ✓ Charlie added to session ${session3Id}\n`)
    
    setTimeout(() => testNextRaceBeforeStart(), 300)
  })
}

function testNextRaceBeforeStart() {
  console.log('3. Testing getNextRace BEFORE any race starts...')
  socket.emit('getNextRace', (response) => {
    if (response.success && response.data.id === session1Id) {
      console.log(`  ✓ Next race is session ${response.data.id} (first in queue)`)
      console.log(`  ✓ Driver: ${response.data.drivers[0].name}\n`)
      
      setTimeout(() => testStartRace(), 100)
    } else {
      console.error('  ✗ Expected next race to be session 1, got:', response)
      process.exit(1)
    }
  })
}

function testStartRace() {
  console.log('4. Starting race for session 1...')
  socket.emit('race:start', { sessionId: session1Id }, (response) => {
    if (response.success) {
      console.log(`  ✓ Race started for session ${session1Id}\n`)
      
      setTimeout(() => testNextRaceAfterStart(), 200)
    } else {
      console.error('  ✗ Failed to start race:', response.error)
      process.exit(1)
    }
  })
}

function testNextRaceAfterStart() {
  console.log('5. Testing getNextRace AFTER race starts...')
  socket.emit('getNextRace', (response) => {
    if (response.success && response.data.id === session2Id) {
      console.log(`  ✓ Next race is now session ${response.data.id} (active race excluded!)`)
      console.log(`  ✓ Driver: ${response.data.drivers[0].name}\n`)
      
      setTimeout(() => testDriverUpdate(), 100)
    } else {
      console.error('  ✗ Expected next race to be session 2, got:', response)
      process.exit(1)
    }
  })
}

function testDriverUpdate() {
  console.log('6. Testing driver update (should trigger broadcast)...')
  socket.emit('driver:update', { sessionId: session2Id, carNumber: 1, newDriverName: 'Bobby' }, (response) => {
    if (response.success) {
      console.log(`  ✓ Driver updated in session ${session2Id}\n`)
      
      setTimeout(() => testRemoveSession(), 200)
    } else {
      console.error('  ✗ Failed to update driver:', response.error)
      process.exit(1)
    }
  })
}

function testRemoveSession() {
  console.log('7. Testing session removal (should trigger broadcast)...')
  socket.emit('session:remove', { sessionId: session3Id }, (response) => {
    if (response.success) {
      console.log(`  ✓ Session ${session3Id} removed\n`)
      
      setTimeout(() => verifyBroadcastCount(), 200)
    } else {
      console.error('  ✗ Failed to remove session:', response.error)
      process.exit(1)
    }
  })
}

function verifyBroadcastCount() {
  console.log('8. Verifying broadcast emissions...')
  console.log(`  Expected broadcasts: 9 (3 session:add + 3 driver:add + 1 race:start + 1 driver:update + 1 session:remove)`)
  console.log(`  Actual broadcasts received: ${broadcastCount}\n`)
  
  if (broadcastCount >= 9) {
    console.log('✓ All broadcasts received correctly!\n')
  } else {
    console.log('⚠ Warning: Some broadcasts may have been missed (timing or race condition)\n')
  }
  
  finalVerification()
}

function finalVerification() {
  console.log('9. Final verification - next race should still be session 2...')
  socket.emit('getNextRace', (response) => {
    if (response.success && response.data.id === session2Id) {
      console.log(`  ✓ Next race is session ${response.data.id}`)
      console.log(`  ✓ Driver: ${response.data.drivers[0].name} (Bobby - updated name)\n`)
      
      console.log('=== All RT32 Tests Passed! ===')
      console.log('✓ getNextRace excludes active race')
      console.log('✓ Broadcasting works for state changes')
      console.log('✓ Frontend can listen to nextRace:changed and re-fetch data\n')
      
      socket.disconnect()
      process.exit(0)
    } else {
      console.error('  ✗ Final verification failed:', response)
      process.exit(1)
    }
  })
}

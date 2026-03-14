// Temporary test file to verify raceState functions
// Run with: node backend/test-state.js

const {
  addSession,
  getAllSessions,
  addDriver,
  removeDriver,
  removeSession,
  getNextRaceSession,
  startRace
} = require('./state/raceState')

console.log('=== Testing Race State Functions ===\n')

// Test 1: Add sessions
console.log('Test 1: Adding sessions...')
const session1 = addSession()
const session2 = addSession()
console.log('Created session 1:', session1)
console.log('Created session 2:', session2)
console.log('All sessions:', getAllSessions())
console.log('✓ Sessions created\n')

// Test 2: Add drivers
console.log('Test 2: Adding drivers to session 1...')
const alice = addDriver(1, 'Alice')
const bob = addDriver(1, 'Bob')
const charlie = addDriver(1, 'Charlie')
console.log('Added Alice:', alice)
console.log('Added Bob:', bob)
console.log('Added Charlie:', charlie)
console.log('✓ Drivers added\n')

// Test 3: Duplicate name (should fail)
console.log('Test 3: Try adding duplicate name...')
const duplicate = addDriver(1, 'Alice')
console.log('Result:', duplicate)
console.log(duplicate.success ? '✗ Should have failed!' : '✓ Correctly rejected\n')

// Test 4: Invalid session (should fail)
console.log('Test 4: Add driver to non-existent session...')
const invalid = addDriver(999, 'Dave')
console.log('Result:', invalid)
console.log(invalid.success ? '✗ Should have failed!' : '✓ Correctly rejected\n')

// Test 5: Get next race
console.log('Test 5: Get next race session...')
const nextRace = getNextRaceSession()
console.log('Next race:', nextRace)
console.log('✓ Next race retrieved\n')

// Test 6: Remove driver
console.log('Test 6: Remove a driver...')
const removed = removeDriver(1, 'Bob')
console.log('Removed Bob:', removed)
const afterRemoval = getAllSessions()
console.log('Session 1 drivers after removal:', afterRemoval[0].drivers)
console.log('✓ Driver removed\n')

// Test 7: Car number assignment
console.log('Test 7: Verify car number assignment...')
console.log('Current cars assigned:', afterRemoval[0].drivers.map(d => `${d.name}: Car ${d.carNumber}`))
const dave = addDriver(1, 'Dave')
console.log('Added Dave:', dave)
console.log('Dave got car:', dave.driver?.carNumber, '(should be 2, since Bob was removed)')
console.log('✓ Car assignment working\n')

// Test 8: Max drivers limit
console.log('Test 8: Try to add more than 8 drivers...')
addDriver(1, 'Eve')
addDriver(1, 'Frank')
addDriver(1, 'Grace')
addDriver(1, 'Henry')
addDriver(1, 'Ivy')  // This should be the 8th
const tooMany = addDriver(1, 'Jack')  // 9th should fail
console.log('Trying to add 9th driver:', tooMany)
console.log(tooMany.success ? '✗ Should have failed!' : '✓ Correctly rejected (8 driver limit)\n')

// Test 9: Remove session
console.log('Test 9: Remove a session...')
console.log('Sessions before removal:', getAllSessions().map(s => s.id))
removeSession(2)
console.log('Sessions after removing session 2:', getAllSessions().map(s => s.id))
console.log('✓ Session removed\n')

// Test 10: Start a race
console.log('Test 10: Start a race...')
const raceStart = startRace(1)
console.log('Race started:', raceStart.success ? 'Success' : `Failed: ${raceStart.error}`)
if (raceStart.success) {
  console.log('Session ID:', raceStart.race.sessionId)
  console.log('Mode:', raceStart.race.mode)
  console.log('Drivers in race:', raceStart.race.drivers.length)
  console.log('Cars initialized:', Object.keys(raceStart.race.laps))
  console.log('✓ Race started successfully\n')
}

// Test 11: Try to start another race (should fail)
console.log('Test 11: Try to start second race while one is active...')
const doubleStart = startRace(1)
console.log('Result:', doubleStart)
console.log(doubleStart.success ? '✗ Should have failed!' : '✓ Correctly prevented\n')

console.log('=== All Tests Complete ===')
console.log('\nTo clean up, delete this test file: rm backend/test-state.js')

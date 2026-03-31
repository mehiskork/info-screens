// Test script for RT35: Manual car selection validation
const io = require('socket.io-client')

const BASE_URL = process.env.SOCKET_URL || 'http://localhost:3000'
const receptionistKey = process.env.RECEPTIONIST_KEY || 'receptionist123'

const socket = io(BASE_URL, {
  auth: {
    role: 'receptionist',
    accessKey: receptionistKey
  }
})

let sessionId = null

socket.on('connect', () => {
  console.log('✓ Connected to server\n')
  runTests()
})

socket.on('connect_error', (error) => {
  console.error('✗ Connection failed:', error.message)
  process.exit(1)
})

async function runTests() {
  console.log('=== RT35 Manual Car Selection Tests ===\n')
  
  // Step 1: Create session
  console.log('1. Creating session...')
  socket.emit('session:add', (response) => {
    if (response.success) {
      sessionId = response.session.id
      console.log(`✓ Session created: ID ${sessionId}\n`)
      
      // Run validation tests
      setTimeout(() => testMissingCarNumber(), 100)
    } else {
      console.error('✗ Failed to create session:', response.error)
      process.exit(1)
    }
  })
}

function testMissingCarNumber() {
  console.log('2. Testing missing carNumber...')
  socket.emit('driver:add', { sessionId, driverName: 'Alice' }, (response) => {
    if (!response.success && response.error.includes('Car number is required')) {
      console.log(`✓ Validation passed: "${response.error}"\n`)
      setTimeout(() => testInvalidCarNumber(), 100)
    } else {
      console.error('✗ Expected error for missing carNumber, got:', response)
      process.exit(1)
    }
  })
}

function testInvalidCarNumber() {
  console.log('3. Testing invalid carNumber (string "abc")...')
  socket.emit('driver:add', { sessionId, driverName: 'Bob', carNumber: 'abc' }, (response) => {
    if (!response.success && response.error.includes('valid number')) {
      console.log(`✓ Validation passed: "${response.error}"\n`)
      setTimeout(() => testOutOfRangeLow(), 100)
    } else {
      console.error('✗ Expected error for invalid carNumber, got:', response)
      process.exit(1)
    }
  })
}

function testOutOfRangeLow() {
  console.log('4. Testing out of range carNumber (0)...')
  socket.emit('driver:add', { sessionId, driverName: 'Charlie', carNumber: 0 }, (response) => {
    if (!response.success && response.error.includes('between 1 and 8')) {
      console.log(`✓ Validation passed: "${response.error}"\n`)
      setTimeout(() => testOutOfRangeHigh(), 100)
    } else {
      console.error('✗ Expected error for out of range carNumber, got:', response)
      process.exit(1)
    }
  })
}

function testOutOfRangeHigh() {
  console.log('5. Testing out of range carNumber (9)...')
  socket.emit('driver:add', { sessionId, driverName: 'David', carNumber: 9 }, (response) => {
    if (!response.success && response.error.includes('between 1 and 8')) {
      console.log(`✓ Validation passed: "${response.error}"\n`)
      setTimeout(() => testSuccessAddDriver(), 100)
    } else {
      console.error('✗ Expected error for out of range carNumber, got:', response)
      process.exit(1)
    }
  })
}

function testSuccessAddDriver() {
  console.log('6. Testing successful driver add (car 3)...')
  socket.emit('driver:add', { sessionId, driverName: 'Eve', carNumber: 3 }, (response) => {
    if (response.success && response.driver.name === 'Eve' && response.driver.carNumber === 3) {
      console.log(`✓ Driver added successfully: ${JSON.stringify(response.driver)}\n`)
      setTimeout(() => testDuplicateCar(), 100)
    } else {
      console.error('✗ Expected successful driver add, got:', response)
      process.exit(1)
    }
  })
}

function testDuplicateCar() {
  console.log('7. Testing duplicate carNumber (3)...')
  socket.emit('driver:add', { sessionId, driverName: 'Frank', carNumber: 3 }, (response) => {
    if (!response.success && response.error.includes('Car 3 is already assigned')) {
      console.log(`✓ Validation passed: "${response.error}"\n`)
      setTimeout(() => testAnotherSuccess(), 100)
    } else {
      console.error('✗ Expected error for duplicate carNumber, got:', response)
      process.exit(1)
    }
  })
}

function testAnotherSuccess() {
  console.log('8. Testing another successful driver add (car 5)...')
  socket.emit('driver:add', { sessionId, driverName: 'Grace', carNumber: 5 }, (response) => {
    if (response.success && response.driver.name === 'Grace' && response.driver.carNumber === 5) {
      console.log(`✓ Driver added successfully: ${JSON.stringify(response.driver)}\n`)
      
      // Final verification - get all drivers
      setTimeout(() => verifyFinalState(), 100)
    } else {
      console.error('✗ Expected successful driver add, got:', response)
      process.exit(1)
    }
  })
}

function verifyFinalState() {
  console.log('9. Verifying final session state...')
  socket.emit('getSessions', (response) => {
    if (!response.success) {
      console.error('✗ Failed to get sessions:', response)
      process.exit(1)
    }

    const session = response.sessions.find(s => s.id === sessionId)
    if (!session) {
      console.error('✗ Session not found in getSessions response:', response.sessions)
      process.exit(1)
    }

    if (session.drivers.length === 2) {
      console.log(`✓ Session has 2 drivers as expected:`)
      session.drivers.forEach(d => {
        console.log(`  - ${d.name}: Car ${d.carNumber}`)
      })
      console.log('\n=== All RT35 Tests Passed! ===')
      socket.disconnect()
      process.exit(0)
    } else {
      console.error('✗ Unexpected final state:', session)
      process.exit(1)
    }
  })
}

# Backend Socket.IO API Documentation

**Server:** `http://localhost:3000` (or your deployed URL)  
**Protocol:** Socket.IO v4.x  
**Status:** ✓ Session Management, Race Control, Lap Timing & Receptionist Auth Implemented

---

## Connection

```javascript
const socket = io('http://localhost:3000')

socket.on('connect', () => {
  console.log('Connected:', socket.id)
})

socket.on('disconnect', () => {
  console.log('Disconnected')
})
```

---

## Broadcast Events

The server emits broadcast events to all connected clients when certain state changes occur. These events have no payload and serve as notifications to re-fetch data.

### Next Race Changed

**Event:** `nextRace:changed`  
**Direction:** Server → All Clients (broadcast)  
**Payload:** None

Emitted when the next race queue changes due to:
- Session added or removed
- Driver added, removed, or updated in any session
- Race started (active race no longer shows as "next")

```javascript
socket.on('nextRace:changed', () => {
  // Re-fetch the next race data
  socket.emit('getNextRace', (response) => {
    if (response.success) {
      console.log('Next race updated:', response.data)
      // Update UI with new next race data
    }
  })
})
```

**Usage Pattern for /next-race frontend:**
```javascript
// Listen for changes
socket.on('nextRace:changed', loadNextRace)

// Initial load
function loadNextRace() {
  socket.emit('getNextRace', (response) => {
    // Update display
  })
}
```

---

## Implemented Events

### Session Management

#### Get All Sessions

**Event:** `getSessions`  
**Auth:** None (public)  
**Payload:** None  
**Response:** `{ success: boolean, sessions: Array }`

```javascript
socket.emit('getSessions', (response) => {
  console.log('Sessions:', response.sessions)
  // response.sessions = [{ id: 1, drivers: [...] }, ...]
})
```

**Session Object Structure:**
```javascript
{
  id: 1,              // Unique session ID
  drivers: [          // Array of drivers in this session
    { 
      name: "Alice",    // Driver name
      carNumber: 1      // Assigned car (1-8)
    }
  ]
}
```

---

#### Add Session

**Event:** `session:add`  
**Auth:** None (pending)  
**Payload:** None  
**Response:** `{ success: boolean, session: Object }`

```javascript
socket.emit('session:add', (response) => {
  if (response.success) {
    console.log('New session created:', response.session)
    // response.session = { id: 1, drivers: [] }
  }
})
```

---

#### Remove Session

**Event:** `session:remove`  
**Auth:** None (pending)  
**Payload:** `{ sessionId: number }`  
**Response:** `{ success: boolean, error?: string }`

```javascript
socket.emit('session:remove', { sessionId: 1 }, (response) => {
  if (response.success) {
    console.log('Session removed')
  } else {
    console.error(response.error) // "Session not found"
  }
})
```

---

#### Get Next Race

**Event:** `getNextRace`  
**Auth:** None (public)  
**Payload:** None  
**Response:** `{ success: boolean, data?: Object, error?: string }`

```javascript
socket.emit('getNextRace', (response) => {
  if (response.success) {
    console.log('Next race:', response.data)
    // response.data = { id: 1, drivers: [...] }
  } else {
    console.log(response.error) // "No queued sessions"
  }
})
```

**Notes:**
- Returns the next queued session (not the currently active race)
- If no race is active, returns the first session in the queue
- If a race is active, returns the session after it in the queue
- Returns error if no sessions are queued

---

### Driver Management

#### Add Driver

**Event:** `driver:add`  
**Auth:** None (pending)  
**Payload:** `{ sessionId: number, driverName: string, carNumber: number }`  
**Response:** `{ success: boolean, driver?: Object, error?: string }`

```javascript
socket.emit('driver:add', { sessionId: 1, driverName: 'Alice', carNumber: 3 }, (response) => {
  if (response.success) {
    console.log('Driver added:', response.driver)
    // response.driver = { name: "Alice", carNumber: 3 }
  } else {
    console.error(response.error)
    // Possible errors:
    // - "Session not found"
    // - "Car number is required"
    // - "Car number must be a valid number"
    // - "Car number must be between 1 and 8"
    // - "Car X is already assigned in this session"
    // - "Driver name must be unique in this session"
    // - "Session is full (max 8 drivers)"
  }
})
```

**Notes:**
- **Car number (1-8) must be provided by the receptionist** (manual selection)
- Car numbers must be unique within a session
- Driver names must be unique within a session
- Maximum 8 drivers per session

---

#### Remove Driver

**Event:** `driver:remove`  
**Auth:** None (pending)  
**Payload:** `{ sessionId: number, driverName: string }`  
**Response:** `{ success: boolean, error?: string }`

```javascript
socket.emit('driver:remove', { sessionId: 1, driverName: 'Alice' }, (response) => {
  if (response.success) {
    console.log('Driver removed')
  } else {
    console.error(response.error)
    // "Session not found" or "Driver not found"
  }
})
```

---

#### Update Driver

**Event:** `driver:update`  
**Auth:** None (pending - receptionist only)  
**Payload:** `{ sessionId: number, carNumber: number, newDriverName: string }`  
**Response:** `{ success: boolean, driver?: Object, error?: string }`

```javascript
socket.emit('driver:update', { 
  sessionId: 1, 
  carNumber: 1, 
  newDriverName: 'Alicia' 
}, (response) => {
  if (response.success) {
    console.log('Driver updated:', response.driver)
    // response.driver = { name: "Alicia", carNumber: 1 }
  } else {
    console.error(response.error)
    // Possible errors:
    // - "Session not found"
    // - "Driver not found in this session"
    // - "Driver name must be unique in this session"
  }
})
```

**Notes:**
- Updates driver name only (car numbers cannot be changed)
- New name must be unique within the session
- Driver is identified by car number

---

### Race Control

#### Start Race

**Event:** `race:start`  
**Auth:** None (pending - safety officer only)  
**Payload:** `{ sessionId: number }`  
**Response:** `{ success: boolean, race?: Object, error?: string }`

```javascript
socket.emit('race:start', { sessionId: 1 }, (response) => {
  if (response.success) {
    console.log('Race started:', response.race)
    // response.race = {
    //   sessionId: 1,
    //   drivers: [...],
    //   mode: 'safe',  // Starts in SAFE mode
    //   startTime: 1234567890,
    //   laps: { 1: {...}, 2: {...}, ... }
    // }
  } else {
    console.error(response.error)
    // Possible errors:
    // - "Session not found"
    // - "Cannot start race with no drivers"
    // - "A race is already in progress"
  }
})
```

**Notes:**
- Races always start in `'safe'` mode (safety car on track)
- Session must have at least 1 driver
- Only one race can be active at a time

---

#### Change Race Mode

**Event:** `race:changeMode`  
**Auth:** None (pending - safety officer only)  
**Payload:** `{ mode: string }`  
**Response:** `{ success: boolean, mode?: string, message?: string, error?: string }`

```javascript
socket.emit('race:changeMode', { mode: 'racing' }, (response) => {
  if (response.success) {
    console.log('Mode changed to:', response.mode)
    // or response.message for 'finished' mode
  } else {
    console.error(response.error)
    // "No active race" or "Invalid mode..."
  }
})
```

**Valid Modes:**
- `'safe'` - Safety car on track
- `'racing'` - Normal racing
- `'paused'` - Race paused
- `'finished'` - Ends race, moves to lastFinishedRace, removes session from queue

**Notes:**
- Setting mode to `'finished'` automatically ends the race and removes the session
- After finishing, you can start a new race

---

### Race Status & Timing

#### Get Current Race Status

**Event:** `getRaceStatus`  
**Auth:** None (public)  
**Payload:** None  
**Response:** `{ success: boolean, race?: Object, error?: string }`

```javascript
socket.emit('getRaceStatus', (response) => {
  if (response.success) {
    console.log('Race:', response.race)
    // response.race = {
    //   sessionId: 1,
    //   drivers: [...],
    //   mode: "racing",
    //   startTime: 1234567890,
    //   laps: {...},
    //   secondsRemaining: 45,
    //   totalDuration: 60
    // }
  } else {
    console.error(response.error) // "No active race"
  }
})
```

**Notes:**
- `secondsRemaining` counts down from race duration to 0
- `totalDuration` is 60 seconds in DEV mode, 600 seconds in production
- Used by spectator displays to show time remaining

---

#### Record Lap Crossing

**Event:** `lap:crossing`  
**Auth:** None (pending - lap-line observer only)  
**Payload:** `{ carNumber: number, timestamp?: number }`  
**Response:** `{ success: boolean, lap?: number, lapTime?: number, bestTime?: number, message?: string, error?: string }`

```javascript
socket.emit('lap:crossing', { carNumber: 1, timestamp: Date.now() }, (response) => {
  if (response.success) {
    if (response.message) {
      console.log(response.message) // "First lap started"
    } else {
      console.log(`Lap ${response.lap} completed in ${response.lapTime}ms`)
      console.log(`Best time: ${response.bestTime}ms`)
    }
  } else {
    console.error(response.error)
    // "No active race" or "Car not in this race"
  }
})
```

**Notes:**
- First crossing starts lap 1, subsequent crossings complete laps and record times
- `timestamp` is optional (defaults to `Date.now()`)
- Lap times are in milliseconds
- Best time is automatically tracked and updated
- Works in all race modes (safe, racing, paused, finished)

---

#### Get Leaderboard

**Event:** `getLeaderboard`  
**Auth:** None (public)  
**Payload:** None  
**Response:** `{ success: boolean, leaderboard?: Array, error?: string }`

```javascript
socket.emit('getLeaderboard', (response) => {
  if (response.success) {
    console.log('Leaderboard:', response.leaderboard)
    // response.leaderboard = [
    //   {
    //     name: "Alice",
    //     carNumber: 1,
    //     bestTime: 34567,      // milliseconds, null if no laps completed
    //     currentLap: 5,
    //     lapTimes: 4           // number of completed laps
    //   },
    //   ...
    // ]
  } else {
    console.error(response.error) // "No active race"
  }
})
```

**Notes:**
- Sorted by `bestTime` (fastest first)
- Drivers with no completed laps (`bestTime: null`) appear last
- Used by spectator display screens

---

## Testing

Test page available at: `http://localhost:3000/test.html`

Complete workflow test:
```javascript
const socket = io()

socket.on('connect', () => {
  // 1. Create session
  socket.emit('session:add', (r) => {
    const sessionId = r.session.id
    
    // 2. Add drivers
    socket.emit('driver:add', { sessionId, driverName: 'Alice', carNumber: 1 }, console.log)
    socket.emit('driver:add', { sessionId, driverName: 'Bob', carNumber: 2 }, console.log)
    
    // 3. Start race
    socket.emit('race:start', { sessionId }, console.log)
    
    // 4. Change mode
    socket.emit('race:changeMode', { mode: 'racing' }, console.log)
    
    // 5. Record lap crossings
    socket.emit('lap:crossing', { carNumber: 1 }, console.log)
    setTimeout(() => {
      socket.emit('lap:crossing', { carNumber: 1 }, console.log) // Complete lap
      socket.emit('getLeaderboard', console.log) // Check standings
    }, 3000)
  })
})
```

---

## Authentication

### Authenticate Receptionist

**Event:** `auth:receptionist`  
**Payload:** `{ accessKey: string }`  
**Response:** `{ success: boolean, role?: string, error?: string }`

```javascript
socket.emit('auth:receptionist', { accessKey: 'your-key-here' }, (response) => {
  if (response.success) {
    console.log('Authenticated as:', response.role)
    // response.role = "receptionist"
    // Grant access to front desk interface
  } else {
    console.error(response.error) // "Invalid access key"
    // Note: Wrong key responses include a 500ms delay to prevent brute force
  }
})
```

**Notes:**
- Correct key: Instant response (~1ms)
- Wrong key: 500ms delay before response (security feature)
- Access key stored in `.env` file as `RECEPTIONIST_KEY`
- Used by front desk interface to authenticate receptionists

---

## TODO - Not Yet Implemented

### Authentication
- `auth:safety` - Authenticate safety official
- `auth:observer` - Authenticate observer (lap-line observer)

### Session Control
- `race:endSession` - Formally end race session after cars return to pit

### Real-time Broadcasting
- Auto-broadcast session changes to all clients
- Auto-broadcast race updates to all clients
- Auto-broadcast lap times to all clients

---

## For Frontend Team

**Current Status:** Core racing features and receptionist authentication are fully functional. You can:
- Create and manage sessions
- Add/remove/update drivers (auto car assignment 1-8)
- Authenticate receptionists with access keys
- Start races and control race modes (safe/racing/paused/finished)
- Query next race in queue
- Record lap crossings and calculate lap times
- Get real-time leaderboard sorted by best lap time
- Get race status with time remaining

**Pending:** Safety & observer authentication, real-time broadcasting, formal session end event

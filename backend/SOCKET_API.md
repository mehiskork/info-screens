# Backend Socket.IO API Documentation

**Server:** `http://localhost:3000` (or your deployed URL)  
**Protocol:** Socket.IO v4.x  
**Status:** ✓ Session Management, Race Control, Lap Timing & Receptionist Auth Implemented

---

## Connection

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    role: 'receptionist',
    accessKey: 'your-key-here'
  }
})

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
- Race session ended (cleared from paddock state)

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

### Race State Update

**Event:** `state:update`  
**Direction:** Server → All Clients (broadcast)  
**Payload:** `{ raceMode: string, timer: Object, hasActiveRace: boolean, sessionId?: number }`

Emitted when race state changes (mode change or race start). Provides synchronized race mode and timer information for all clients.

```javascript
socket.on('state:update', (data) => {
  console.log('Race mode:', data.raceMode)
  console.log('Timer:', data.timer)
  // data = {
  //   raceMode: "SAFE",  // "DANGER", "SAFE", "HAZARD", or "FINISH" (uppercase)
  //   timer: {
  //     running: true,
  //     endsAt: 1234567890  // Unix timestamp in milliseconds
  //   },
  //   hasActiveRace: true,
  //   sessionId: 12
  // }
})
```

**Race Modes:**
- `'DANGER'` - No active race, danger condition (red flag)
- `'SAFE'` - Safety car on track (green flag)
- `'HAZARD'` - Yellow flag, drive slowly
- `'FINISH'` - Race ended (checkered flag)

**Timer Object:**
- When race is active: `{ running: true, endsAt: <timestamp> }`
- When no race: `{ running: false }`

**Emitted When:**
- Race started
- Race mode changed (safe/hazard/danger/finish)
- Timer reaches zero and backend auto-switches race mode to `finish`
- Lifecycle tick keeps flag displays and countdown timers synchronized

---

### Race Lifecycle Update

**Event:** `race:lifecycle`  
**Direction:** Server → All Clients (broadcast)  
**Payload:** `{ hasActiveRace, raceStatus, leaderboard, lastFinishedRace }`

Emitted whenever race state or lap data changes and on periodic lifecycle tick.

```javascript
socket.on('race:lifecycle', (payload) => {
  console.log(payload.hasActiveRace)
  console.log(payload.raceStatus)
  console.log(payload.leaderboard)
  console.log(payload.lastFinishedRace)
})
```

---

### Race Session Ended

**Event:** `race:sessionEnded`  
**Direction:** Server → All Clients (broadcast)  
**Payload:** `{ sessionId: number | null, endedAt: number, source: string }`

Emitted when Safety clears a finished session from paddock state.

```javascript
socket.on('race:sessionEnded', (payload) => {
  console.log(payload.sessionId)
  console.log(payload.endedAt)
  console.log(payload.source)
})
```

**Payload Fields:**
- `sessionId` - Session that was cleared, or `null` if unavailable
- `endedAt` - Unix timestamp in milliseconds when the session was cleared
- `source` - Triggering event name (`session:end` or `race:endSession`)

---

## Implemented Events

### Session Management

#### Get All Sessions

**Event:** `getSessions`  
**Auth:** Receptionist (required)  
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
  drivers: [          // Array of drivers in this session (sorted by carNumber)
    { 
      name: "Alice",    // Driver name
      carNumber: 1      // Assigned car (1-8)
    }
  ]
}
```

**Notes:**
- Returns only **queued upcoming sessions** (excludes the currently active race)
- Drivers within each session are **sorted by carNumber** (ascending, numeric)
- If a race is active, that session will not appear in the results

---

#### Add Session

**Event:** `session:add`  
**Auth:** Receptionist (required)  
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
**Auth:** Receptionist (required)  
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
**Response:** `{ success: boolean, state?: string, data?: Object, error?: string }`

```javascript
socket.emit('getNextRace', (response) => {
  if (response.success) {
    console.log('Next race state:', response.state)
    console.log('Next race:', response.data)
    // response.state = "upcoming" or "paddock"
    // response.data = { id: 1, drivers: [...] }
  } else {
    console.log(response.error) // "No queued sessions"
  }
})
```

**Response States:**
- `'upcoming'` - Normal queued session ready to race
- `'paddock'` - Finished session requiring paddock clearance (drivers must return cars to pit)

**Notes:**
- Returns the next queued session (not the currently active race)
- If no race is active, returns the first session in the queue
- If a race is active, returns the session after it in the queue
- After finishing a race, the finished session enters "paddock" state before being cleared
- Returns error if no sessions are queued and no session is in paddock
- Drivers are **sorted by carNumber** (ascending, numeric) in returned data

**Paddock Flow:**
1. Race finishes (mode changed to 'finish')
2. Session moves to paddock state (visible to next-race display)
3. Next-race display shows "Proceed to paddock" message with driver list
4. Safety Official ends session via `session:end` when cars return to pit
5. Paddock clears, next queued session becomes active

---

### Driver Management

#### Add Driver

**Event:** `driver:add`  
**Auth:** Receptionist (required)  
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
**Auth:** Receptionist (required)  
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
**Auth:** Receptionist (required)  
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
**Auth:** Safety (required)  
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
**Auth:** Safety (required)  
**Payload:** `{ mode: string }`  
**Response:** `{ success: boolean, mode?: string, message?: string, error?: string }`

```javascript
socket.emit('race:changeMode', { mode: 'hazard' }, (response) => {
  if (response.success) {
    console.log('Mode changed to:', response.mode)
    // or response.message for 'finish' mode
  } else {
    console.error(response.error)
    // "No active race" or "Invalid mode..."
  }
})
```

**Valid Modes:**
- `'safe'` - Safety car on track (green flag)
- `'hazard'` - Yellow flag, drive slowly
- `'danger'` - Red flag, stop driving
- `'finish'` - Ends race, moves to paddock state (waiting for cars to return)

**Notes:**
- Setting mode to `'finish'` ends active timing and puts race into finish state
- Timer expiry also auto-switches mode to `'finish'` server-side
- After finishing, session remains visible on next-race display until cleared via `session:end`
- After paddock is cleared, you can start a new race
- Mode names are lowercase when sending to backend, but broadcast as uppercase in state:update events

---

#### End Race Session

**Event:** `session:end`  
**Auth:** Safety (required)  
**Payload:** None  
**Response:** `{ success: boolean, message?: string, error?: string }`

**Broadcasts on success:**
- `race:sessionEnded` with `{ sessionId, endedAt, source }`
- `nextRace:changed`
- `state:update`
- `race:status`
- `race:lifecycle`

```javascript
socket.emit('session:end', (response) => {
  if (response.success) {
    console.log(response.message) // "Session ended - next session ready"
    // Paddock cleared, next race can proceed
  } else {
    console.error(response.error) // "No ended session to clear"
  }
})
```

**Notes:**
- Used by Safety Official to formally end a race session after cars return to paddock
- Only works when a session is in paddock state (race finished, waiting for clearance)
- Automatically emits `nextRace:changed` to update all clients
- Clears paddock state and makes next queued session available
- Call this after drivers have returned their cars to the pit area

**Usage in Race Control:**
1. Finish race (set mode to 'finish')
2. Wait for all drivers to return cars to paddock
3. Call `session:end` to clear session and proceed to next race

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
    //   mode: "safe",
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

#### Get Race Lifecycle Snapshot

**Event:** `getRaceLifecycle`  
**Auth:** Public  
**Payload:** None  
**Response:** `{ success: true, hasActiveRace, raceStatus, leaderboard, lastFinishedRace }`

```javascript
socket.emit('getRaceLifecycle', (response) => {
  if (response.success) {
    console.log(response.lastFinishedRace)
  }
})
```

---

#### Record Lap Crossing

**Event:** `lap:crossing`  
**Auth:** Observer (required)  
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
- Works in all race modes (safe, hazard, danger, finish)

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
    socket.emit('race:changeMode', { mode: 'hazard' }, console.log)
    
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

Authentication happens during the Socket.IO handshake, before real-time connection is established.

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    role: 'observer', // receptionist | safety | observer
    accessKey: 'your-key-here'
  }
})

socket.on('connect_error', (err) => {
  console.error(err.message)
})
```

**Notes:**
- Deprecated events `auth:receptionist`, `auth:safety`, and `auth:observer` are no longer valid login flow.
- Wrong key responses still include a 500ms delay (anti brute-force).
- Access keys are configured in environment variables.

---

## TODO - Not Yet Implemented

### Authentication
- ✅ All authentication implemented (receptionist, safety, observer)

### Session Control
- ✅ `session:end` - Formally end race session after cars return to pit (RT44)

### Real-time Broadcasting
- ✅ Auto-broadcast race state updates (`state:update` event - RT30/RT42)
- ✅ Auto-broadcast next race changes (`nextRace:changed` event)
- Future: Auto-broadcast lap times to all clients

---

## For Frontend Team

**Current Status:** Core racing features and all authentication roles are fully functional. You can:
- Create and manage sessions
- Add/remove/update drivers (manual car assignment 1-8)
- Authenticate receptionists, safety officials, and observers with handshake access keys
- Start races and control race modes (safe/hazard/danger/finish)
- Query next race in queue with state information (upcoming/paddock)
- End race sessions after paddock return via `session:end` event
- Record lap crossings and calculate lap times
- Get real-time leaderboard sorted by best lap time
- Get race status with time remaining
- Real-time broadcasts: `nextRace:changed`, `state:update`, and `race:lifecycle`

**Available Interfaces:**
- `/front-desk` - Receptionist authentication, session and driver management
- `/next-race` - Public display of next race with paddock state support and real-time updates
- `/race-control` - Safety official authentication, race start/mode control, session end
- `/race-countdown` - Race timer display (needs connection to backend)
- `/race-flags` - Race status flag display (needs connection to backend)
- `/lap-line-tracker` - Observer authentication, lap crossing recording (NEW in RT41)
- `/leader-board` - Leaderboard display route owned by backend Express

**Pending:** Real-time broadcasting for lap events

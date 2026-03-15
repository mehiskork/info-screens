# Backend Socket.IO API Documentation

**Server:** `http://localhost:3000` (or your deployed URL)  
**Protocol:** Socket.IO v4.x  
**Status:** � Session Management & Race Control Implemented (Auth pending)

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

---

### Driver Management

#### Add Driver

**Event:** `driver:add`  
**Auth:** None (pending)  
**Payload:** `{ sessionId: number, driverName: string }`  
**Response:** `{ success: boolean, driver?: Object, error?: string }`

```javascript
socket.emit('driver:add', { sessionId: 1, driverName: 'Alice' }, (response) => {
  if (response.success) {
    console.log('Driver added:', response.driver)
    // response.driver = { name: "Alice", carNumber: 1 }
  } else {
    console.error(response.error)
    // Possible errors:
    // - "Session not found"
    // - "Driver name must be unique in this session"
    // - "Session is full (max 8 drivers)"
  }
})
```

**Notes:**
- Car numbers (1-8) are auto-assigned (lowest available)
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
    socket.emit('driver:add', { sessionId, driverName: 'Alice' }, console.log)
    socket.emit('driver:add', { sessionId, driverName: 'Bob' }, console.log)
    
    // 3. Start race
    socket.emit('race:start', { sessionId }, console.log)
    
    // 4. Change mode
    socket.emit('race:changeMode', { mode: 'racing' }, console.log)
  })
})
```

---

## TODO - Not Yet Implemented

### Authentication
- `auth:receptionist` - Authenticate receptionist
- `auth:safety` - Authenticate safety official
- `auth:observer` - Authenticate observer

### Lap Tracking
- `lap:crossing` - Record car crossing lap line
- `getLeaderboard` - Get sorted results by best lap time

### Race Status
- `getCurrentRaceStatus` - Get current race with time remaining

### Real-time Broadcasting
- Auto-broadcast session changes to all clients
- Auto-broadcast race updates to all clients

---

## For Frontend Team

**Current Status:** All session management and basic race control events are functional. You can:
- Create and manage sessions
- Add/remove drivers (auto car assignment 1-8)
- Start races and control race modes
- Query next race in queue

**Pending:** Authentication, lap timing, leaderboards, real-time broadcasting

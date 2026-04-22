# Backend Socket.IO API Documentation

**Server:** `http://localhost:3000` (or your deployed URL)  
**Protocol:** Socket.IO v4.x  
**Status:** ✓ Session Management, Race Control, Lap Timing, All-Time Leaderboard, Start Lights & All Auth Roles Implemented

---

## Connection

Public (spectator) clients may connect without credentials. Privileged roles must provide `role` and `accessKey` in the handshake `auth` object.

```javascript
// Public / spectator connection
const socket = io('http://localhost:3000')

// Privileged connection (receptionist | safety | observer)
const socket = io('http://localhost:3000', {
  auth: {
    role: 'receptionist', // 'receptionist' | 'safety' | 'observer'
    accessKey: 'your-key-here'
  }
})

socket.on('connect', () => {
  console.log('Connected:', socket.id)
})

socket.on('connect_error', (err) => {
  console.error('Auth failed:', err.message)
})

socket.on('disconnect', () => {
  console.log('Disconnected')
})
```

On connection, the server immediately emits a full state snapshot to the connecting socket only — see [On-Connect Snapshot Events](#on-connect-snapshot-events).

---

## Broadcast Events

The server emits these events to **all connected clients** when state changes occur.

---

### Next Race Changed

**Event:** `nextRace:changed`  
**Direction:** Server → All Clients  
**Payload:** None

Emitted when the next race queue changes due to:
- Session added or removed
- Driver added, removed, or updated in any session
- Race started (active race no longer shows as "next")
- Race session ended (cleared from paddock state)

```javascript
socket.on('nextRace:changed', () => {
  socket.emit('getNextRace', (response) => {
    if (response.success) {
      console.log('Next race updated:', response.data)
    }
  })
})
```

---

### Race State Update

**Event:** `state:update`  
**Direction:** Server → All Clients  
**Payload:** `{ raceMode: string, timer: Object, hasActiveRace: boolean, sessionId?: number }`

Emitted on every lifecycle tick (1 s) and on any race state change. Primary source of truth for flag displays and countdown timers.

```javascript
socket.on('state:update', (data) => {
  // data = {
  //   raceMode: "SAFE",       // "DANGER" | "SAFE" | "HAZARD" | "FINISH" (uppercase)
  //   timer: {
  //     running: true,
  //     endsAt: 1234567890    // Unix timestamp ms; present when running: true
  //   },
  //   hasActiveRace: true,
  //   sessionId: 12           // present when hasActiveRace: true
  // }
})
```

**Race Modes (uppercase):**
- `'DANGER'` – No active race or red flag
- `'SAFE'` – Safety car / green flag
- `'HAZARD'` – Yellow flag, drive slowly
- `'FINISH'` – Race ended

**Timer object:**
- Active race: `{ running: true, endsAt: <timestamp> }`
- No active race or finished: `{ running: false }`

---

### Race Lifecycle Update

**Event:** `race:lifecycle`  
**Direction:** Server → All Clients  
**Payload:**

```javascript
socket.on('race:lifecycle', (payload) => {
  // payload = {
  //   hasActiveRace: boolean,
  //   isFrozenSnapshot: boolean,         // true when showing post-race frozen data
  //   snapshotState: string,             // 'live' | 'post-race-frozen' | 'idle'
  //   raceStatus: Object | null,         // current race object, or null
  //   leaderboard: Object | null,        // leaderboard result object, or null
  //   leaderboardUpdate: Object | null,  // full leaderboard payload (same as leaderboard:updated)
  //   lastFinishedRace: Object | null,
  //   frozenSnapshot: {                  // only present when isFrozenSnapshot: true
  //     race: Object | null,
  //     leaderboard: Array | null,
  //     lapDisplayMode: 'completedLaps'
  //   } | null
  // }
})
```

Emitted on every lap crossing, race start/end, and on the lifecycle tick when `leaderboard:updated` is broadcast.

---

### Race Session Ended

**Event:** `race:sessionEnded`  
**Direction:** Server → All Clients  
**Payload:** `{ sessionId: number | null, endedAt: number, source: string }`

Emitted when Safety clears a finished session from paddock state.

```javascript
socket.on('race:sessionEnded', (payload) => {
  // payload = {
  //   sessionId: 12,             // session that was cleared, or null if unavailable
  //   endedAt: 1234567890,       // Unix timestamp ms
  //   source: 'session:end'      // 'session:end' | 'race:endSession'
  // }
})
```

---

### Race Status

**Event:** `race:status`  
**Direction:** Server → All Clients  
**Payload:**

```javascript
socket.on('race:status', (data) => {
  if (!data.active) {
    // data = {
    //   active: false,
    //   mode: 'danger',
    //   timer: { running: false },
    //   isFrozenSnapshot: boolean,
    //   snapshotState: string,       // 'post-race-frozen' | 'idle'
    //   secondsRemaining: 0,
    //   lastFinishedRace: Object | null
    // }
  } else {
    // data = {
    //   active: true,
    //   isFrozenSnapshot: false,
    //   snapshotState: 'live',
    //   sessionId: 12,
    //   mode: 'safe',                // lowercase ('safe' | 'hazard' | 'danger' | 'finish')
    //   secondsRemaining: 45,
    //   totalDuration: 600,          // seconds (60 in DEV, 600 in production)
    //   startTime: 1234567890,       // Unix timestamp ms
    //   lastFinishedRace: Object | null
    // }
  }
})
```

Emitted alongside `race:lifecycle` on every state change and lifecycle tick.

---

### Race Started

**Event:** `race:started`  
**Direction:** Server → All Clients  
**Payload:** `{ sessionId: number }`

Emitted immediately when a race begins.

```javascript
socket.on('race:started', ({ sessionId }) => {
  console.log('Race started for session', sessionId)
})
```

---

### Race Mode Changed

**Event:** `race:modeChanged`  
**Direction:** Server → All Clients  
**Payload:** `{ mode: string }`

Emitted whenever the race mode is changed manually (lowercase mode string).

```javascript
socket.on('race:modeChanged', ({ mode }) => {
  console.log('New mode:', mode) // 'safe' | 'hazard' | 'danger' | 'finish'
})
```

---

### Race Finished

**Event:** `race:finished`  
**Direction:** Server → All Clients  
**Payload:** `{ sessionId: number | null, reason: string }`

Emitted when the race ends (mode set to `'finish'`), whether manually or by timer expiry.

```javascript
socket.on('race:finished', ({ sessionId, reason }) => {
  // reason: 'manual' | 'timer-expired'
  console.log('Race', sessionId, 'finished:', reason)
})
```

---

### Leaderboard Updated

**Event:** `leaderboard:updated`  
**Direction:** Server → All Clients  
**Payload:**

```javascript
socket.on('leaderboard:updated', (payload) => {
  // payload = {
  //   leaderboard: Array,          // sorted leaderboard entries (see getLeaderboard)
  //   hasActiveRace: boolean,
  //   isFrozenSnapshot: boolean,
  //   snapshotState: string,       // 'live' | 'post-race-frozen' | 'idle'
  //   lapDisplayMode: string | null,
  //   source: string | null,
  //   sessionId: number | null,
  //   raceMode: string | null
  // }
})
```

Emitted after every lap crossing, race start, and session end.

---

### All-Time Leaderboard Updated

**Event:** `allTimeLeaderboard:updated`  
**Direction:** Server → All Clients  
**Payload:** `{ topTen: Array, updatedAt: number }`

Emitted only when the all-time top-10 changes after a lap is recorded.

```javascript
socket.on('allTimeLeaderboard:updated', ({ topTen, updatedAt }) => {
  // topTen = [
  //   { driverName, carNumber, lapTime, recordedAt, sessionId },
  //   ...
  // ]
})
```

---

### Lap Recorded

**Event:** `lap:recorded`  
**Direction:** Server → All Clients  
**Payload:** `{ carNumber, timestamp, lap, lapTime, bestTime }`

Emitted after every successful lap crossing.

```javascript
socket.on('lap:recorded', (data) => {
  // data = {
  //   carNumber: 3,
  //   timestamp: 1234567890,   // Unix ms
  //   lap: 4,                  // lap number just completed (null on first crossing)
  //   lapTime: 34567,          // ms (null on first crossing)
  //   bestTime: 32100          // ms (null if no completed laps yet)
  // }
})
```

---

### Start Lights: Begin

**Event:** `startLights:begin`  
**Direction:** Server → All Clients  
**Payload:** None

Emitted when the start-lights sequence is initiated by a Safety Official.

---

### Start Lights: Step

**Event:** `startLights:step`  
**Direction:** Server → All Clients  
**Payload:** `number` (1–5)

Emitted once per second as each light illuminates. Value is the current step count.

```javascript
socket.on('startLights:step', (step) => {
  console.log('Lights lit:', step) // 1, 2, 3, 4, 5
})
```

---

### Start Lights: Go

**Event:** `startLights:go`  
**Direction:** Server → All Clients  
**Payload:** None

Emitted when Safety triggers the go signal. Lights auto-reset to idle ~3 s later.

---

## On-Connect Snapshot Events

When a client connects, the server immediately emits two snapshot events **to that socket only** to synchronise its initial state without requiring any requests.

### Race Status Snapshot

**Event:** `race:statusSnapshot`  
**Direction:** Server → Connecting Client only

```javascript
socket.on('race:statusSnapshot', (snapshot) => {
  // snapshot = {
  //   hasActiveRace: boolean,
  //   isFrozenSnapshot: boolean,
  //   snapshotState: string,       // 'live' | 'post-race-frozen' | 'idle'
  //   raceStatus: Object | null,
  //   leaderboard: Object | null,
  //   leaderboardUpdate: Object | null,
  //   lastFinishedRace: Object | null,
  //   frozenSnapshot: Object | null,
  //   lights: {                    // current start-lights state
  //     active: boolean,
  //     step: number,              // 0–5
  //     phase: string              // 'idle' | 'counting' | 'ready' | 'go'
  //   }
  // }
})
```

### All-Time Leaderboard Snapshot

**Event:** `allTimeLeaderboard:snapshot`  
**Direction:** Server → Connecting Client only

```javascript
socket.on('allTimeLeaderboard:snapshot', ({ topTen, updatedAt }) => {
  // topTen = [{ driverName, carNumber, lapTime, recordedAt, sessionId }, ...]
})
```

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

**Session Object:**
```javascript
{
  id: 1,
  drivers: [
    { name: "Alice", carNumber: 1 }
  ]
}
```

**Notes:**
- Returns only **queued upcoming sessions** (excludes the currently active race session)
- Drivers are **sorted by carNumber** (ascending, numeric)

---

#### Add Session

**Event:** `session:add`  
**Auth:** Receptionist (required)  
**Payload:** None  
**Response:** `{ success: boolean, session: Object }`

Broadcasts `nextRace:changed` on success.

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

Broadcasts `nextRace:changed` on success.

```javascript
socket.emit('session:remove', { sessionId: 1 }, (response) => {
  if (!response.success) {
    console.error(response.error) // "Session not found"
  }
})
```

---

#### Get Next Race

**Event:** `getNextRace`  
**Auth:** None (public)  
**Payload:** None  
**Response:** `{ success: boolean, state?: string, paddock?: boolean, data?: Object, error?: string }`

```javascript
socket.emit('getNextRace', (response) => {
  if (response.success) {
    console.log('State:', response.state)          // 'upcoming' | 'paddock'
    console.log('Paddock active:', response.paddock) // true if a session is in paddock
    console.log('Session:', response.data)
  } else {
    console.log(response.error) // "No queued sessions"
  }
})
```

**Response States:**
- `'upcoming'` – Normal queued session ready to race
- `'paddock'` – Finished session awaiting paddock clearance

**`paddock` boolean:** `true` when a finished session is currently in paddock state (even while another queued session is returned as upcoming).

**Paddock Flow:**
1. Race finishes (mode → `'finish'`)
2. Finished session enters paddock state
3. Next-race display shows "Proceed to paddock" with driver list
4. Safety Official emits `session:end` once cars are returned
5. Paddock clears; next queued session becomes the upcoming race

---

### Driver Management

#### Add Driver

**Event:** `driver:add`  
**Auth:** Receptionist (required)  
**Payload:** `{ sessionId: number, driverName: string, carNumber?: number }`
**Response:** `{ success: boolean, driver?: Object, error?: string }`

Broadcasts `nextRace:changed` on success.

```javascript
socket.emit('driver:add', { sessionId: 1, driverName: 'Alice', carNumber: 3 }, (response) => {
  if (response.success) {
    console.log('Driver added:', response.driver)
    // response.driver = { name: "Alice", carNumber: 3 }
  } else {
    console.error(response.error)
    // Possible errors:
    // - "Session not found"
    // - "Car number must be a valid number"
    // - "Car number must be between 1 and 8"
    // - "Car X is already assigned in this session"
    // - "Driver name must be unique in this session"
    // - "Session is full (max 8 drivers)"
    // - "Cannot modify a session while it is racing"
  }
})
```

**Notes:**
- If `carNumber` is omitted or blank, the smallest available car number is assigned automatically
- If `carNumber` is provided, it must be between 1 and 8
- Car numbers must be unique within a session
- Driver names must be unique within a session
- Maximum 8 drivers per session

---

#### Remove Driver

**Event:** `driver:remove`  
**Auth:** Receptionist (required)  
**Payload:** `{ sessionId: number, driverName: string }`  
**Response:** `{ success: boolean, error?: string }`

Broadcasts `nextRace:changed` on success.

```javascript
socket.emit('driver:remove', { sessionId: 1, driverName: 'Alice' }, (response) => {
  if (!response.success) {
    console.error(response.error)
    // "Session not found" | "Driver not found"
  }
})
```

---

#### Update Driver

**Event:** `driver:update`  
**Auth:** Receptionist (required)  
**Payload:** `{ sessionId: number, carNumber: number, newDriverName: string }`  
**Response:** `{ success: boolean, driver?: Object, error?: string }`

Broadcasts `nextRace:changed` on success.

```javascript
socket.emit('driver:update', { sessionId: 1, carNumber: 1, newDriverName: 'Alicia' }, (response) => {
  if (response.success) {
    console.log('Driver updated:', response.driver)
    // response.driver = { name: "Alicia", carNumber: 1 }
  } else {
    console.error(response.error)
    // - "Session not found"
    // - "Driver not found in this session"
    // - "Driver name must be unique in this session"
  }
})
```

**Notes:**
- Updates driver name only; car numbers cannot be changed
- Driver is identified by car number

---

### Race Control

#### Start Race

**Event:** `race:start`  
**Auth:** Safety (required)  
**Payload:** `{ sessionId?: number }`  
**Response:** `{ success: boolean, race?: Object, error?: string }`

**Broadcasts on success:** `race:started`, `race:modeChanged`, `nextRace:changed`, `race:status`, `race:lifecycle`, `leaderboard:updated`, `state:update`

```javascript
socket.emit('race:start', { sessionId: 1 }, (response) => {
  if (response.success) {
    console.log('Race started:', response.race)
  } else {
    console.error(response.error)
    // - "Session not found"
    // - "Cannot start race with no drivers"
    // - "A race is already in progress"
    // - "No sessions available to start"
  }
})
```

**Notes:**
- `sessionId` is **optional** — if omitted, the server auto-selects the first queued session
- Races always start in `'safe'` mode
- Only one race can be active at a time

---

#### Change Race Mode

**Event:** `race:changeMode`  
**Auth:** Safety (required)  
**Payload:** `{ mode: string }`  
**Response:** `{ success: boolean, mode?: string, message?: string, error?: string }`

**Broadcasts on success:** `race:modeChanged`, `race:finished` (if mode is `'finish'`), `race:status`, `state:update`

```javascript
socket.emit('race:changeMode', { mode: 'hazard' }, (response) => {
  if (response.success) {
    console.log('Mode changed to:', response.mode)
  } else {
    console.error(response.error)
    // "No active race" | "Invalid mode..."
  }
})
```

**Valid modes (lowercase when sending):**
- `'safe'` – Safety car / green flag
- `'hazard'` – Yellow flag
- `'danger'` – Red flag
- `'finish'` – Ends timing, moves session to paddock state

**Notes:**
- `'finish'` stops the timer and emits `race:finished`
- Timer expiry auto-switches mode to `'finish'` server-side
- Mode is broadcast as **uppercase** in `state:update` events

---

#### Change Race Mode (Legacy Alias)

**Event:** `race:mode:set`  
**Auth:** Safety (required)  
**Payload:** `mode` as a bare string (not wrapped in an object)  
**Response:** Same as `race:changeMode`

```javascript
// Legacy format used by some frontend pages
socket.emit('race:mode:set', 'hazard', (response) => { ... })
```

Prefer `race:changeMode` for new code.

---

#### End Race Session

**Event:** `session:end`  
**Auth:** Safety (required)  
**Payload:** None  
**Response:** `{ success: boolean, message?: string, error?: string }`

**Broadcasts on success:** `race:sessionEnded`, `nextRace:changed`, `race:status`, `race:lifecycle`, `leaderboard:updated`, `state:update`

```javascript
socket.emit('session:end', (response) => {
  if (response.success) {
    console.log(response.message) // "Session ended - next session ready"
  } else {
    console.error(response.error) // "No ended session to clear"
  }
})
```

**Notes:**
- Only works when a session is in paddock state (race finished, awaiting clearance)
- Clears paddock state and makes the next queued session available

**Workflow:**
1. Finish race (set mode to `'finish'`)
2. Wait for all drivers to return cars to paddock
3. Emit `session:end` to clear the session

---

#### End Race Session (Legacy Alias)

**Event:** `race:endSession`  
**Auth:** Safety (required)  
**Payload:** None  
**Response:** Same as `session:end`

Identical behaviour to `session:end`. Prefer `session:end` for new code.

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
    //   totalDuration: 600       // 60 in DEV, 600 in production
    // }
  } else {
    console.error(response.error) // "No active race"
  }
})
```

---

#### Get Race Lifecycle Snapshot

**Event:** `getRaceLifecycle`  
**Auth:** None (public)  
**Payload:** None  
**Response:** `{ success: true, hasActiveRace, isFrozenSnapshot, snapshotState, raceStatus, leaderboard, leaderboardUpdate, lastFinishedRace, frozenSnapshot }`

```javascript
socket.emit('getRaceLifecycle', (response) => {
  console.log(response.hasActiveRace)
  console.log(response.snapshotState)  // 'live' | 'post-race-frozen' | 'idle'
  console.log(response.frozenSnapshot) // populated during post-race freeze period
})
```

---

#### Record Lap Crossing

**Event:** `lap:crossing`  
**Auth:** Observer (required)  
**Payload:** `{ carNumber: number, timestamp?: number }`  
**Response:** `{ success: boolean, lap?: number, lapTime?: number, bestTime?: number, message?: string, error?: string }`

**Broadcasts on success:** `lap:recorded`, `leaderboard:updated`, `race:lifecycle`, `allTimeLeaderboard:updated` (only if top-10 changes)

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
    // "No active race" | "Car not in this race"
  }
})
```

**Notes:**
- First crossing starts lap 1; subsequent crossings complete laps and record times
- `timestamp` is optional (defaults to `Date.now()`)
- Lap times are in milliseconds
- Works in all race modes

---

#### Get Leaderboard

**Event:** `getLeaderboard`  
**Auth:** None (public)  
**Payload:** None  
**Response:** `{ success: boolean, leaderboard?: Array, error?: string }`

```javascript
socket.emit('getLeaderboard', (response) => {
  if (response.success) {
    console.log(response.leaderboard)
    // [
    //   {
    //     name: "Alice",
    //     carNumber: 1,
    //     bestTime: 34567,    // ms; null if no completed laps
    //     currentLap: 5,
    //     lapTimes: 4         // number of completed laps
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

---

### All-Time Leaderboard

#### Get All-Time Top Ten

**Event:** `allTimeLeaderboard:get`  
**Auth:** None (public)  
**Payload:** None  
**Response:** `{ success: true, topTen: Array, updatedAt: number }`

```javascript
socket.emit('allTimeLeaderboard:get', (response) => {
  console.log(response.topTen)
  // [
  //   { driverName, carNumber, lapTime, recordedAt, sessionId },
  //   ...
  // ]
})
```

**Notes:**
- Returns up to 10 entries, sorted by lap time (fastest first)
- Persisted across server restarts
- Updated in real-time via `allTimeLeaderboard:updated` broadcasts

---

#### Get All-Time History Summary

**Event:** `allTimeLeaderboard:historySummary:get`  
**Auth:** None (public)  
**Payload:** None  
**Response:** `{ success: true, totalRecordedLaps: number, topTenCount: number }`

```javascript
socket.emit('allTimeLeaderboard:historySummary:get', (response) => {
  console.log(`${response.totalRecordedLaps} total laps recorded`)
  console.log(`${response.topTenCount} entries in top 10`)
})
```

---

### Start Lights

The start-lights sequence is controlled by Safety Officials and broadcasts to all clients for the start-lights display.

#### Begin Lights Sequence

**Event:** `startLights:begin`  
**Auth:** Safety (required)  
**Payload:** None  
**Response:** None (rejected silently if a sequence is already active)

**Broadcasts:** `startLights:begin` immediately, then `startLights:step` (1–5) once per second

```javascript
socket.emit('startLights:begin')
```

The server emits `startLights:step` with values 1–5 at one-second intervals. After step 5 the sequence pauses at `phase: 'ready'` awaiting the go signal.

---

#### Trigger Go Signal

**Event:** `startLights:go`  
**Auth:** Safety (required)  
**Payload:** None  
**Response:** None (rejected silently if no active sequence)

**Broadcasts:** `startLights:go` immediately; lights auto-reset to idle after ~3 s

```javascript
socket.emit('startLights:go')
```

---

## Authentication

Authentication is performed during the Socket.IO handshake, before the connection is established.

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    role: 'observer', // 'receptionist' | 'safety' | 'observer'
    accessKey: 'your-key-here'
  }
})

socket.on('connect_error', (err) => {
  console.error(err.message) // 'Unauthorized' | 'Invalid auth payload...'
})
```

**Notes:**
- Public/spectator clients can connect with no `auth` object
- Access keys are configured in environment variables
- The deprecated runtime auth events (`auth:receptionist`, `auth:safety`, `auth:observer`) still exist but always return an error directing callers to use handshake auth instead

---

## For Frontend Team

**Current Status:** Core racing features and all authentication roles are fully functional. You can:
- Create and manage sessions
- Add/remove/update drivers (manual car assignment 1-8, with smallest-available auto assignment when omitted)
- Authenticate receptionists, safety officials, and observers with handshake access keys
- Start races and control race modes (safe/hazard/danger/finish)
- Query next race in queue with state information (upcoming/paddock)
- End race sessions after paddock return via `session:end` event
- Record lap crossings and calculate lap times
- Get real-time leaderboard sorted by best lap time
- Get race status with time remaining
- Real-time broadcasts: `nextRace:changed`, `state:update`, and `race:lifecycle`

**Available Interfaces:**
- `/front-desk` – Receptionist: session and driver management
- `/next-race` – Public display of next race with paddock state and real-time updates
- `/race-control` – Safety: race start/mode control, session end, start lights
- `/race-countdown` – Race timer display
- `/race-flags` – Race flag status display
- `/lap-line-tracker` – Observer: lap crossing recording
- `/leaderboard` – Live leaderboard display (route served by backend Express)
- `/start-lights` – Start lights sequence display

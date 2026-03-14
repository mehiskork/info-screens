# Backend Socket.IO API Documentation

**Server:** `http://localhost:3000` (or your deployed URL)  
**Protocol:** Socket.IO v4.x  
**Status:** 🚧 Early Development - Only basic connection implemented

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

### Get All Sessions

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

## Testing

Test page available at: `http://localhost:3000/socket-test.html`

Basic test code:
```javascript
const socket = io()

socket.on('connect', () => {
  console.log('✓ Connected')
  
  // Test getting sessions
  socket.emit('getSessions', (response) => {
    console.log('Response:', response)
  })
})
```

---

## TODO - Not Yet Implemented

The following features are planned but not yet available:

### Authentication
- `auth:receptionist` - Authenticate receptionist
- `auth:safety` - Authenticate safety official
- `auth:observer` - Authenticate observer

### Session Management (Requires Auth)
- `session:add` - Create new session
- `session:remove` - Delete session
- `driver:add` - Add driver to session
- `driver:remove` - Remove driver from session

### Race Control (Requires Auth)
- `race:start` - Start a race
- `race:changeMode` - Change flag mode
- `race:end` - End race session

### Lap Tracking (Requires Auth)
- `lap:crossing` - Record car crossing lap line

### Real-time Subscriptions
- `subscribe:sessions` - Get session updates
- `subscribe:nextRace` - Get next race updates
- `subscribe:currentRace` - Get race updates

---

## For Frontend Team

**Current Status:** You can connect to the server and test the basic Socket.IO connection. Only `getSessions` event is functional.

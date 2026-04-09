# Racetrack Info Screens

Real-time MVP for managing race sessions and public information screens at Beachside Racetrack.

This project provides employee interfaces for preparing and controlling races, plus public displays for drivers and spectators. The system is built with **Node.js**, **Express**, and **Socket.IO** so that all interfaces update in real time without polling.

It supports:

- upcoming race session management
- receptionist-selected car assignments
- live race control and flag state changes
- lap-line tracking with large car buttons
- real-time leaderboard and public displays
- persisted state across server restarts

---

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup and Installation](#setup-and-installation)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Available Routes](#available-routes)
- [How the System Works](#how-the-system-works)
- [User Guide](#user-guide)
  - [Front Desk](#front-desk)
  - [Race Control](#race-control)
  - [Lap-line Tracker](#lap-line-tracker)
  - [Leader Board](#leader-board)
  - [Next Race](#next-race)
  - [Race Countdown](#race-countdown)
  - [Race Flags](#race-flags)
- [Persistence](#persistence)
- [Extra Functionality](#extra-functionality)
- [Security](#security)
- [Socket.IO Event Notes](#socketio-event-notes)
- [Authors](#authors)

---

## Project Overview

Beachside Racetrack needs a minimum viable system to:

- prepare upcoming race sessions
- start and control races
- record lap-line crossings
- show real-time race information on public screens

This application solves those problems with separate interfaces for reception staff, race control, lap tracking, and public displays. Actions in one interface are immediately reflected in the others through Socket.IO.

The system is designed around the race lifecycle:

1. The receptionist creates sessions and assigns drivers to cars.
2. Drivers view the upcoming session on the Next Race display.
3. The Safety Official starts the race from Race Control.
4. The Lap-line Observer records crossings on a tablet-friendly interface.
5. Guests and drivers follow the race on the public displays.
6. The Safety Official finishes and ends the session, which queues the next race.

---

## Features

### Core functionality

- Create, view, and delete upcoming race sessions
- Add, edit, and remove drivers from a session
- Enforce unique driver names within a session
- Assign cars to drivers before the race starts
- Show the upcoming race and car assignments on the Next Race display
- Start a race from Race Control
- Change race modes between Safe, Hazard, Danger, and Finish
- Show race flag state in real time on the Race Flags display
- Track lap-line crossings per car
- Update the leaderboard in real time
- Show fastest lap, current lap, timer, and flag state on the leaderboard
- End a race session and automatically queue the next one

### Real-time behavior

- Uses **Socket.IO** for live communication between interfaces
- No polling is used for race state changes
- Public displays react instantly to:
  - session changes
  - race start
  - race mode changes
  - lap-line crossings
  - session end

### Extra functionality

- Persisted application state across server restarts
- Receptionist-selected car assignment instead of random allocation


---

## Tech Stack

- **Backend:** Node.js
- **Framework:** Express
- **Real-time communication:** Socket.IO
- **Frontend:** HTML, CSS, and JavaScript
- **Configuration:** dotenv
- **Persistence:** local JSON file storage

---

## Project Structure

```text
.
├── backend/
│   ├── config/
│   ├── persistence/
│   ├── public/
│   ├── services/
│   ├── sockets/
│   ├── state/
│   ├── utils/
│   ├── SOCKET_API.md
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── front-desk/
│   ├── lap-line-tracker/
│   ├── leaderboard/
│   ├── next-race/
│   ├── race-control/
│   ├── race-countdown/
│   ├── race-flags/
│   └── shared/
├── package.json
└── README.md
```

### Important files

- `package.json` - root scripts for start and dev mode
- `backend/server.js` - Express and Socket.IO server setup
- `backend/config/settings.js` - environment variables and timer configuration
- `backend/state/raceState.js` - in-memory race/session logic
- `backend/persistence/localStateStore.js` - persisted app state
- `backend/persistence/allTimeLapStore.js` - persisted all-time laps
- `backend/SOCKET_API.md` - Socket.IO event reference

---

## Setup and Installation

### 1. Clone the repository

```bash
git clone https://gitea.kood.tech/mehiskork/info-screens
cd info-screens
```

### 2. Install dependencies

You can install from the project root.

```bash
npm install
```

This project uses the root `package.json` to run the backend scripts.

### 3. Create a `.env` file

Create a `.env` file in the project root:

```env
RECEPTIONIST_KEY=receptionist123
SAFETY_KEY=safety123
OBSERVER_KEY=observer123
PORT=3000
```

### 4. Start the server

```bash
npm start
```

### 5. Start the server in development mode

```bash
npm run dev
```

In development mode, the race timer lasts **1 minute** instead of **10 minutes**.

---

## Environment Variables

The employee interfaces are protected by access keys, and the server will not start unless all required keys are defined.

### Required variables

- `RECEPTIONIST_KEY` - unlocks `/front-desk`
- `SAFETY_KEY` - unlocks `/race-control`
- `OBSERVER_KEY` - unlocks `/lap-line-tracker`


### Startup validation

On startup, the server checks whether all three keys exist. If any key is missing, the process exits with an error.

---

## Running the App

### Production mode

```bash
npm start
```

Behavior:

- race duration is **10 minutes**
- server runs with normal timing rules

### Development mode

```bash
npm run dev
```

Behavior:

- race duration is **1 minute**
- useful for faster testing and demos

### Local access

After starting the server, open the app in your browser:

```text
http://localhost:3000/front-desk
```

## Available Routes

| Interface | Persona | Route |
|---|---|---|
| Front Desk | Receptionist | `/front-desk` |
| Race Control | Safety Official | `/race-control` |
| Lap-line Tracker | Lap-line Observer | `/lap-line-tracker` |
| Leader Board | Guest / Spectator | `/leader-board` |
| Next Race | Race Driver | `/next-race` |
| Race Countdown | Race Driver | `/race-countdown` |
| Race Flags | Race Driver | `/race-flags` |

### Additional backend routes

| Route | Purpose |
|---|---|
| `/api/leaderboard/all-time` | Returns persisted all-time top 10 lap data as JSON |
| `/all-time-best-laps` | Placeholder route for a future all-time leaderboard screen |

---

## How the System Works

### Session queue

The system stores upcoming race sessions in a queue. Each session contains:

- a session ID
- a list of drivers
- a car number assigned to each driver

The first queued session is the next race to be started, unless a race is already active.

### Starting a race

When the Safety Official starts a race:

- the selected session becomes the active race
- race mode becomes `safe`
- the timer starts
- lap tracking is initialized for each car
- the Leader Board switches to the live race
- the Next Race display switches to the following queued session

### Lap tracking model

Each car is tracked by car number.

- The **first lap starts when the car crosses the lap line for the first time**.
- The first press sets the car to lap 1 but does not generate a lap time yet.
- Every later press calculates a lap time from the previous crossing.
- The best lap is updated if the new lap is faster.

### Race modes

Supported race modes:

- `safe`
- `hazard`
- `danger`
- `finish`

Once the race enters `finish` mode, it cannot be changed back to another mode.

### Ending a session

After the race is in `finish` mode and the cars have returned to the pit lane, the Safety Official ends the session.

That action:

- removes the finished session from the queue
- stores the finished race as a frozen snapshot
- resets the active race state
- changes the system back to a waiting state
- makes the next session available
- allows the Next Race display to show paddock guidance

### Frozen post-race leaderboard

After a race ends, the last finished race remains visible on the leaderboard until the next race starts. This lets drivers and spectators continue viewing lap results between sessions.

---

## Front Desk

**Route:** `/front-desk`  
**Persona:** Receptionist

### Purpose

Used to manage the upcoming race queue before a race starts.

### Access

- The interface is locked on first load.
- The receptionist must enter the correct access key before using it.
- On an incorrect key, the server delays the response by 500ms and the interface asks again.

### Main actions

- view the list of upcoming race sessions
- add a session
- remove a session
- add a driver to a session
- edit a driver name
- remove a driver
- assign a car number to a driver

### Rules enforced

- driver names must be unique within a session
- car numbers must be unique within a session
- car numbers must be between 1 and 8
- a session can contain at most 8 drivers

### Typical use

1. Unlock the interface.
2. Create a new session.
3. Add drivers and assign car numbers.
4. Repeat for the next sessions in the queue.

---

## Race Control

**Route:** `/race-control`  
**Persona:** Safety Official

### Purpose

Used to start races, control race mode, and end the session.

### Access

- The interface requires the safety access key.
- Incorrect keys are delayed by 500ms before rejection.

### Main actions

- start the active race
- switch race mode to Safe, Hazard, Danger, or Finish
- end the session after the race reaches Finish mode

### Expected workflow

1. Unlock Race Control.
2. Review the next session and driver/car assignments.
3. Press **Start Race**.
4. Use mode controls during the race.
5. Change to **Finish** when the race is over.
6. End the session once the cars have returned.

### Important behavior

- only one race can be active at a time
- a race cannot start if the session has no drivers
- once the race is in Finish mode, it cannot return to Safe, Hazard, or Danger
- ending a session requires the race to already be in Finish mode

---

## Lap-line Tracker

**Route:** `/lap-line-tracker`  
**Persona:** Lap-line Observer

### Purpose

Used to record when cars cross the lap line.

### Access

- The interface requires the observer access key.
- Incorrect keys are delayed by 500ms before rejection.

### Main actions

- view one button per active car
- tap the matching car number when that car crosses the lap line

### Behavior

- the button layout is intended to be easy to tap quickly
- buttons appear only for the active race
- when the race is ended, lap input is no longer allowed
- in Finish mode, each car can record one final crossing

### Lap timing rules

- first crossing starts lap 1
- second crossing records the first lap time
- later crossings continue updating lap count and best lap time

---

## Leader Board

**Route:** `/leader-board`  
**Persona:** Guest / Spectator

### Purpose

Shows live race standings for spectators and drivers.

### Displays

- driver name
- car number
- fastest lap time
- current lap
- remaining race time
- current flag state

### Ordering

Drivers are ordered by fastest lap time:

- fastest laps appear first
- drivers without a recorded lap time appear below those with valid times

### Behavior

- updates in real time when laps are recorded
- updates in real time when race mode changes
- keeps the previous race visible after it ends, until the next race starts

---

## Next Race

**Route:** `/next-race`  
**Persona:** Race Driver

### Purpose

Shows the next upcoming session and each driver's assigned car.

### Displays

- next queued session
- driver names
- assigned car numbers
- empty state when no upcoming race exists
- paddock message after a session is ended

### Behavior

- before a race starts, it shows the next queued session
- when a race starts, it switches to the following queued session
- after a session ends, it can show an additional message instructing drivers to proceed to the paddock

---

## Race Countdown

**Route:** `/race-countdown`  
**Persona:** Race Driver / Public display

### Purpose

Shows the remaining time for the current race.

### Behavior

- updates in real time during the race
- shows `00:00` when the race is in Finish mode
- uses 10 minutes in normal mode
- uses 1 minute in development mode

---

## Race Flags

**Route:** `/race-flags`  
**Persona:** Race Driver / Public display

### Purpose

Shows the current race mode as a visual flag display.

### Display mapping

- **Safe** → solid green
- **Hazard** → solid yellow
- **Danger** → solid red
- **Finish** → chequered black/white

### Behavior

- updates in real time when the Safety Official changes mode
- intended for full-screen display use around the track
- contains no race management controls

---

## Persistence

This project implements persisted state as extra functionality.

### Stored application state

The application writes state to local JSON files inside the backend data directory.

Persisted data includes:

- upcoming race sessions
- current race state
- current race mode
- lap state for active cars
- frozen finished-race snapshot
- ended-session paddock metadata
- all-time lap history
- all-time top 10 best laps

### Startup recovery behavior

On server restart:

- queued sessions are restored
- the current race is restored if still valid
- if an active race should already have expired, startup reconciliation moves it into Finish mode
- the leaderboard can continue from restored state

### Storage files

- `backend/data/state.json`
- `backend/data/all-time-laps.json`

---

## Extra Functionality

### Persisted state

The project persists its application state so that the server can restart without losing the queue and key race data.

### Receptionist-selected cars

Instead of relying on random allocation, the receptionist chooses the car number for each driver when setting up a session.

### All-time lap data

The backend also keeps an all-time lap history and top 10 best laps list.

Available endpoint:

```text
GET /api/leaderboard/all-time
```

This is not required for the MVP public screens, but it is implemented in the backend.

---

## Security

The three employee interfaces are protected:

- `/front-desk`
- `/race-control`
- `/lap-line-tracker`

### Security rules

- the real-time connection is gated behind access-key authentication in the UI flow
- each employee role has its own access key
- invalid keys are rejected after a 500ms delay
- the user is then prompted again for a correct key

### Environment setup requirement

The server will not start unless all required access keys are present in the `.env` file.

---

## Socket.IO Event Notes

The application uses Socket.IO for real-time updates between interfaces.

### Examples of event categories

- authentication events
- session management events
- race lifecycle events
- lap tracking events
- leaderboard events
- next-race update events

---

### Authors

**Elvis Rüütel**<br>
**Sten Martin Üürike**<br>
**Sven Kunsing**<br>
**Mehis Kork**

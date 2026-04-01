let socket = null
let raceFinished = false
let endTime = null
let currentMode = ""
let lastText = ""
let lockedNextRace = null

// Lock screen
const lockScreen = document.getElementById("lock-screen")
const accessKeyInput = document.getElementById("access-key")
const unlockBtn = document.getElementById("unlock-btn")
const errorMessage = document.getElementById("error-message")

// Race panel
const racePanel = document.getElementById("race-panel")
const status = document.getElementById("race-status")
const startBtn = document.getElementById("start")
const safeBtn = document.getElementById("safe")
const hazardBtn = document.getElementById("hazard")
const dangerBtn = document.getElementById("danger")
const finishBtn = document.getElementById("finish")
const endSessionBtn = document.getElementById("end-session")
const miniTimer = document.getElementById("mini-timer")

// Info areas
const currentRaceEl = document.getElementById("current-race")
const nextRaceEl = document.getElementById("next-race")

racePanel.style.display = "none"
endSessionBtn.style.display = "none"
racePanel.hidden = true

// AUTH
const form = document.getElementById("auth-form")

form.addEventListener("submit", (e) => {
    e.preventDefault()

    const accessKey = accessKeyInput.value.trim()

    if (!accessKey) {
        errorMessage.textContent = "Enter access key"
        return
    }

    if (socket) socket.disconnect()

    socket = io({
        auth: {
            role: "safety",
            accessKey: accessKey
        }
    })

    socket.on("connect", () => {
        console.log("Connected as safety:", socket.id)
        if (socket) {
            socket.removeAllListeners()
        }
        setupSocketEvents()
    })

    socket.on("connect_error", (err) => {
        console.log("CONNECT ERROR:", err.message)

        if (err.message === "xhr poll error") {
            errorMessage.textContent = "Cannot connect to server"
        } else {
            errorMessage.textContent = "Invalid safety key"
        }
    })
})

// SAFE EMIT
function emitSafe(event, data, callback) {
    if (!socket || !socket.connected) {
        alert("Not connected")
        return
    }
    socket.emit(event, data, callback)
}

// BUTTONS
startBtn.onclick = () => {
    socket.emit("getNextRace", (res) => {
        if (!res?.success) {
            alert("No upcoming race")
            return
        }

        const sessionId = res.data.id
        lockedNextRace = res.data

        emitSafe("race:start", { sessionId }, (res) => {
            if (!res.success) alert(res.error)
        })
    })
}

safeBtn.onclick = () => setMode("safe")
hazardBtn.onclick = () => setMode("hazard")
dangerBtn.onclick = () => setMode("danger")
finishBtn.onclick = () => setMode("finish")

function setMode(mode) {
    if (raceFinished) return

    emitSafe("race:changeMode", { mode }, (res) => {
        console.log("MODE:", mode, res)
        if (!res.success) alert(res.error)
    })
}

// END SESSION
endSessionBtn.onclick = () => {
    if (!socket || !socket.connected) return

    socket.emit("race:endSession", (res) => {
        console.log("END SESSION:", res)
        if (!res.success) alert(res.error)
    })
}

// SOCKET EVENTS
function setupSocketEvents() {

    socket.onAny((event, data) => {
        console.log("EVENT:", event, data)
    })

    socket.on("race:statusSnapshot", (state) => {
        console.log("SNAPSHOT:", state)

        lockScreen.style.display = "none"
        racePanel.style.display = "block"

        if (!state.raceStatus) {
            status.innerText = "No active race"
            status.style.color = "#ccc"
            return

        }


        handleState(state.raceStatus)
        renderCurrentRace(state.raceStatus)
        loadNextRace()
    })

    socket.on("race:status", (state) => {
        const s = state.raceStatus || state

        handleState(s)
        renderCurrentRace(s)

        if (!lockedNextRace) {
            loadNextRace()
        }
    })

    socket.on("race:modeChanged", (state) =>
        handleState(state.raceStatus || state)
    )

    socket.on("race:finished", () => {
        raceFinished = true
        endSessionBtn.style.display = "inline"
    })

    socket.on("race:sessionEnded", () => {
        raceFinished = false
        endSessionBtn.style.display = "none"
        lockedNextRace = null
        loadNextRace()
    })

    socket.on("nextRace:changed", () => {
        console.log("Next race updated")

        if (!lockedNextRace) {
            loadNextRace()
        }
    })
}

// STATE
function handleState(state) {
    if (!state) {
        setIdle()
        updateUIState(false)
        return
    }

    const isActive = state.active ?? state.hasActiveRace
    const mode = (state.mode || state.raceMode || "").toLowerCase()

    currentMode = mode
    updateUIState(isActive, mode)

    if (!isActive) {
        setIdle()
        return
    }

    status.innerText = "Mode: " + mode.toUpperCase()

    if (mode === "safe") status.style.color = "lime"
    else if (mode === "hazard") status.style.color = "yellow"
    else if (mode === "danger") status.style.color = "red"
    else if (mode === "finish") status.style.color = "white"

    if (state.startTime && state.totalDuration) {
        endTime = Number(state.startTime) + Number(state.totalDuration) * 1000
    }
}

function setIdle() {
    status.innerText = "No active race"
    status.style.color = "red"
    raceFinished = false
    endSessionBtn.style.display = "none"
    endTime = null
}

// CURRENT RACE
function renderCurrentRace(race) {
    if (!currentRaceEl || !race) return

    const entries = race.entries || race.drivers || []

    let text = "Current: " + (race.name || "Session " + race.id)

    if (entries.length) {
        const list = entries.map(e =>
            `${e.driverName || e.name || "Driver"} (${e.carNumber || "?"})`
        )
        text += "\n" + list.join(", ")
    }

    currentRaceEl.innerText = text
}

// NEXT RACE
function loadNextRace() {
    if (!socket) return

    const titleEl = document.getElementById("next-race-title")
    const listEl = document.getElementById("next-race-list")

    listEl.innerHTML = ""

    if (lockedNextRace) {
        const race = lockedNextRace

        titleEl.innerText = "Next: " + (race.name || "Session " + race.id)

        const entries = race.entries || race.drivers || []

        entries.forEach(e => {
            const row = document.createElement("div")
            row.className = "driver-row"

            row.innerHTML = `
                <div class="driver-badge">${e.carNumber || "-"}</div>
                <div class="driver-name">${e.driverName || e.name || "Driver"}</div>
            `

            listEl.appendChild(row)
        })

        return
    }

    socket.emit("getNextRace", (res) => {
        if (!res?.success) {
            titleEl.innerText = "No upcoming races"
            listEl.innerHTML = ""
            startBtn.disabled = true
            return
        }

        const race = res.data

        titleEl.innerText = "Next: " + (race.name || "Session " + race.id)

        const entries = race.entries || race.drivers || []

        entries.forEach(e => {
            const row = document.createElement("div")
            row.className = "driver-row"

            row.innerHTML = `
                <div class="driver-badge">${e.carNumber || "-"}</div>
                <div class="driver-name">${e.driverName || e.name || "Driver"}</div>
            `

            listEl.appendChild(row)
        })

        startBtn.disabled = false
    })
}

// TIMER
function updateTimer() {
    if (!endTime || currentMode === "finish") {
        if (lastText !== "00:00:00") {
            miniTimer.innerText = "00:00:00"
            lastText = "00:00:00"
        }
        return
    }

    const remaining = Math.max(0, endTime - Date.now())

    const min = Math.floor(remaining / 60000)
    const sec = Math.floor((remaining % 60000) / 1000)
    const hund = Math.floor((remaining % 1000) / 10)

    const text =
        String(min).padStart(2, "0") + ":" +
        String(sec).padStart(2, "0") + ":" +
        String(hund).padStart(2, "0")

    if (text !== lastText) {
        miniTimer.innerText = text
        lastText = text
    }
}

function startTimerLoop() {
    function loop() {
        updateTimer()
        requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
}

startTimerLoop()

// UI
function updateUIState(hasActiveRace, mode) {
    startBtn.style.display = "none"
    safeBtn.style.display = "none"
    hazardBtn.style.display = "none"
    dangerBtn.style.display = "none"
    finishBtn.style.display = "none"
    endSessionBtn.style.display = "none"

    if (!hasActiveRace) {
        startBtn.style.display = "block"
        return
    }

    if (mode !== "finish") {
        safeBtn.style.display = "block"
        hazardBtn.style.display = "block"
        dangerBtn.style.display = "block"
        finishBtn.style.display = "block"
    }

    if (mode === "finish") {
        endSessionBtn.style.display = "block"
    }
}
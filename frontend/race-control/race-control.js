let socket = null
let raceFinished = false

// Lock screen elements
const lockScreen = document.getElementById("lock-screen")
const accessKeyInput = document.getElementById("access-key")
const unlockBtn = document.getElementById("unlock-btn")
const errorMessage = document.getElementById("error-message")

// Race panel elements
const racePanel = document.getElementById("race-panel")
const status = document.getElementById("race-status")
const startBtn = document.getElementById("start")
const safeBtn = document.getElementById("safe")
const hazardBtn = document.getElementById("hazard")
const dangerBtn = document.getElementById("danger")
const finishBtn = document.getElementById("finish")
const endSessionBtn = document.getElementById("end-session")

endSessionBtn.style.display = "none"
racePanel.hidden = true


// AUTH (HANDSHAKE)

const form = document.getElementById("auth-form")

form.addEventListener("submit", (e) => {
    e.preventDefault() // stop page reload

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
        setupSocketEvents()
    })

    socket.on("connect_error", (err) => {
        errorMessage.textContent = "Invalid safety key"
    })
})

// Enter key support
accessKeyInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") unlockBtn.click()
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
    emitSafe("race:start", null, (res) => {
        console.log("START:", res)
        if (!res.success) alert(res.error)
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

// Correct end session
endSessionBtn.onclick = () => {
    emitSafe("race:endSession", null, (res) => {
        console.log("END SESSION:", res)
        if (!res.success) alert(res.error)
    })
}


// SOCKET EVENTS

function setupSocketEvents() {

    // Debug all events (VERY useful)
    socket.onAny((event, data) => {
        console.log("EVENT:", event, data)
    })

    // INITIAL STATE (unlock UI here!)
    socket.on("race:statusSnapshot", (state) => {
        console.log("SNAPSHOT:", state)

        // ALWAYS UNLOCK (auth is already successful)
        lockScreen.style.display = "none"
        racePanel.style.display = "block"

        // Check if race exists
        if (!state.raceStatus || state.raceStatus.success === false) {
            status.innerText = "No active race"
            status.style.color = "white"
            return
        }

        // Normal case
        handleState(state.raceStatus)
    })

    // LIVE UPDATES
    socket.on("race:status", (state) => handleState(state.raceStatus || state))
    socket.on("race:modeChanged", (state) => handleState(state.raceStatus || state))

    socket.on("race:finished", () => {
        raceFinished = true
        endSessionBtn.style.display = "inline"
    })

    socket.on("race:sessionEnded", () => {
        raceFinished = false
        endSessionBtn.style.display = "none"
        status.innerText = "Session ended"
    })

    // TEMP BACKWARD COMPAT
    socket.on("state:update", handleState)
}


// UI STATE HANDLER

function handleState(state) {
    if (!state || state.success === false) {
        status.innerText = "No active race"
        status.style.color = "white"
        return
    }

    const mode = (state.mode || "").toLowerCase()

    status.innerText = "Mode: " + mode.toUpperCase()

    if (mode === "safe") {
        status.style.color = "lime"
    } else if (mode === "hazard") {
        status.style.color = "yellow"
    } else if (mode === "danger") {
        status.style.color = "red"
    } else if (mode === "finish") {
        status.style.color = "white"
        raceFinished = true
        endSessionBtn.style.display = "inline"
    }
}


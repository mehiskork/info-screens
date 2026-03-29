const socket = io()
const timer = document.getElementById("timer")

let endTime = null

// HANDLE STATE FROM NEW BACKEND
function handleState(state) {
    const race = state.raceStatus || state.race || state

    if (!race) return

    const startTime = race.startTime
    const duration = race.totalDuration

    if (startTime && duration) {
        endTime = startTime + duration * 1000
    } else {
        endTime = null
        timer.innerText = "00:00"
    }
}

// NEW EVENTS
socket.on("race:statusSnapshot", handleState)
socket.on("race:status", handleState)
socket.on("race:modeChanged", handleState)

// fallback (optional)
socket.on("state:update", (state) => {
    if (state.timer?.endsAt) {
        endTime = state.timer.endsAt
    }
})

// TIMER LOOP
function updateTimer() {
    if (!endTime) return

    const remaining = Math.max(0, endTime - Date.now())

    const min = Math.floor(remaining / 60000)
    const sec = Math.floor((remaining % 60000) / 1000)

    timer.innerText =
        String(min).padStart(2, "0") + ":" +
        String(sec).padStart(2, "0")

    // DO NOT EMIT FINISH HERE (backend handles it)
}

setInterval(updateTimer, 1000)
const socket = io()
const timer = document.getElementById("timer")

let endTime = null
let currentMode = null
let hideTimer

document.addEventListener("mousemove", () => {
    document.body.style.cursor = "default"

    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
        if (document.fullscreenElement) {
            document.body.style.cursor = "none"
        }
    }, 2000)
})

const fsBtn = document.getElementById("fullscreen-btn")

fsBtn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
    } else {
        document.exitFullscreen()
    }
})

document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) {
        document.body.classList.add("fullscreen-mode")
        fsBtn.style.display = "none"
    } else {
        document.body.classList.remove("fullscreen-mode")
        fsBtn.style.display = "block"
    }
})

function handleTimerState(state) {
    const race = state.raceStatus || state

    if (!race) return

    currentMode = (race.mode || "").toLowerCase()

    const isActive = race.active ?? state.hasActiveRace

    if (!isActive) {
        endTime = null
        timer.innerText = "00:00:00"
        return
    }

    if (currentMode === "finish") {
        endTime = null
        timer.innerText = "00:00:00"
        return
    }

    if (race.startTime && race.totalDuration) {
        endTime = race.startTime + race.totalDuration * 1000
    }
}

// USE ONLY THESE EVENTS
socket.on("race:statusSnapshot", handleTimerState)
socket.on("race:status", handleTimerState)
socket.on("race:modeChanged", handleTimerState)



// TIMER LOOP
let lastText = ""

function updateTimer() {
    if (currentMode === "finish") {
        if (lastText !== "00:00:00") {
            timer.innerText = "00:00:00"
            lastText = "00:00:00"
        }
        return
    }

    if (!endTime) {
        if (lastText !== "00:00:00") {
            timer.innerText = "00:00:00"
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
        timer.innerText = text
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
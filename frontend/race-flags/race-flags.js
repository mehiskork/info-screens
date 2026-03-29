const socket = io()
const screen = document.getElementById("screen")

let lastUpdate = Date.now()

// FULLSCREEN
document.getElementById("fullscreen").onclick = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
    } else {
        document.exitFullscreen()
    }
}

// SINGLE STATE HANDLER
function handleState(state) {
    lastUpdate = Date.now()

    const race = state.raceStatus || state.race || state
    const modeRaw = race.mode || state.raceMode || ""
    const mode = modeRaw.toLowerCase()

    renderMode(mode)
}

// NEW EVENTS
socket.on("race:statusSnapshot", handleState)
socket.on("race:status", handleState)
socket.on("race:modeChanged", handleState)

// fallback
socket.on("state:update", handleState)

// RENDER
function renderMode(mode) {

    screen.style.background = ""
    screen.style.color = "white"
    screen.style.textShadow = "none"
    screen.style.fontWeight = "normal"

    if (mode === "safe") {
        screen.style.background = "green"
    }

    else if (mode === "hazard") {
        screen.style.background = "yellow"
        screen.style.color = "black"
    }

    else if (mode === "danger") {
        screen.style.background = "red"
    }

    else if (mode === "finish") {
        screen.style.background =
            "repeating-conic-gradient(black 0% 25%, white 0% 50%) 0 0 / 400px 400px "

    }
}



setInterval(() => {
    if (Date.now() - lastUpdate > 1500000) {
        showNoSignal()
    }
}, 1000)
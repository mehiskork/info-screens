const socket = io()

const screen = document.getElementById("screen")

let lastUpdate = Date.now()

// FULLSCREEN BUTTON
document.getElementById("fullscreen").onclick = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
    } else {
        document.exitFullscreen()
    }
}

// CONNECTION STATUS
socket.on("connect", () => {
    screen.innerText = "CONNECTED"
})

socket.on("disconnect", () => {
    screen.style.background = "black"
    screen.style.color = "white"
    screen.innerText = "DISCONNECTED"
})

// MAIN STATE SYNC (FIXED)
socket.on("state:update", (state) => {

    console.log("STATE:", state)

    lastUpdate = Date.now()

    const mode = state.raceMode

    // RESET STYLE
    screen.style.background = ""
    screen.style.color = "white"
    screen.style.textShadow = "none"
    screen.style.fontWeight = "normal"

    if (mode === "safe") {
        screen.style.background = "green"
        screen.innerText = "SAFE"
    }

    if (mode === "hazard") {
        screen.style.background = "yellow"
        screen.style.color = "black"
        screen.innerText = "HAZARD"
    }

    if (mode === "danger") {
        screen.style.background = "red"
        screen.innerText = "DANGER"
    }

    if (mode === "finish") {
        screen.style.background =
            "repeating-conic-gradient(black 0% 25%, white 0% 50%) 0 0 / 400px 400px "
        screen.innerText = "FINISH"
    }
})

// NO SIGNAL (OPTIONAL)
setInterval(() => {
    if (Date.now() - lastUpdate > 150000) {
        screen.style.background = "black"
        screen.style.color = "white"
        screen.innerText = "NO SIGNAL"
    }
}, 1000)
let currentMode = ""

const socket = io()
const screen = document.getElementById("screen")

let lastUpdate = Date.now()

// FULLSCREEN
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

    setTimeout(() => renderMode(currentMode), 100)
})

// SINGLE STATE HANDLER
function handleState(state) {
    lastUpdate = Date.now()

    const race = state.raceStatus || state.race || state
    const modeRaw = race.mode || state.raceMode || ""
    const mode = modeRaw.toLowerCase()

    currentMode = mode

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

    }

    else if (mode === "danger") {
        screen.style.background = "red"
    }

    else if (mode === "finish") {

        const cols = 5
        const rows = 3


        screen.style.border = "none"

        const width = screen.clientWidth
        const height = screen.clientHeight

        // ideal sizes
        let sizeX = width / cols
        let sizeY = height / rows


        sizeX = Math.round(sizeX)
        sizeY = Math.round(sizeY)


        const finalWidth = sizeX * cols
        const finalHeight = sizeY * rows

        screen.style.background = `
        repeating-conic-gradient(black 0% 25%, white 0% 50%)
        0 0 / ${sizeX}px ${sizeY}px
    `

        // center if tiny mismatch (rare)
        const offsetX = Math.floor((width - finalWidth) / 2)
        const offsetY = Math.floor((height - finalHeight) / 2)

        screen.style.backgroundPosition = `${offsetX}px ${offsetY}px`


        screen.style.boxSizing = "border-box"
        screen.style.border = "5px solid black"
    }




    screen.style.imageRendering = "pixelated"

}

screen.style.backgroundRepeat = "no-repeat"

document.body.style.margin = "0"
document.documentElement.style.margin = "0"

window.addEventListener("resize", () => {
    renderMode(currentMode)
})





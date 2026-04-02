const socket = io()
const timer = document.getElementById("timer")
let hideTimer

const timerModel = window.createRaceTimerModel({
    showHundredths: true,
    onTick: ({ text }) => {
        timer.innerText = text
    }
})

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
    timerModel.applyState(state)
}

// USE ONLY THESE EVENTS
socket.on("race:statusSnapshot", handleTimerState)
socket.on("race:status", handleTimerState)
socket.on("race:modeChanged", handleTimerState)

timerModel.start()
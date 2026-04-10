const socket = io(window.location.origin)

const lights = [
    document.getElementById("l1"),
    document.getElementById("l2"),
    document.getElementById("l3"),
    document.getElementById("l4"),
    document.getElementById("l5")
]

const statusText = document.getElementById("status-text")

function resetLights() {
    lights.forEach(l => l.classList.remove("on", "go"))
}

function goLights() {
    lights.forEach(l => {
        l.classList.remove("on")
        l.classList.add("go")
    })



    setTimeout(() => {
        resetLights()

    }, 3000)
}

// SOCKET EVENTS

socket.on("connect", () => {
    resetLights()
})

socket.on("startLights:begin", () => {
    showLights()
    resetLights()

})

socket.on("startLights:step", (step) => {
    lights[step - 1].classList.add("on")
})

socket.on("startLights:go", () => {
    goLights()

    setTimeout(() => {
        showIdle()
    }, 2500)
})

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
        fsBtn.style.opacity = "0"
        fsBtn.style.pointerEvents = "none"
    } else {
        document.body.classList.remove("fullscreen-mode")
        fsBtn.style.opacity = "0.6"
        fsBtn.style.pointerEvents = "auto"
    }

    setTimeout(() => renderMode(currentMode), 100)
})

const lightsContainer = document.getElementById("lights")
const idleText = document.getElementById("idle-text")

function showIdle() {
    idleText.style.display = "block"
    lightsContainer.style.display = "none"
}

function showLights() {
    idleText.style.display = "none"
    lightsContainer.style.display = "grid"
}

showIdle()
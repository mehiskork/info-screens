const socket = io()

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

// Authentication
unlockBtn.addEventListener("click", () => {
    const accessKey = accessKeyInput.value.trim()

    if (accessKey === "") {
        errorMessage.textContent = "Enter safety key"
        return
    }

    socket.emit("auth:safety", { accessKey }, (response) => {
        console.log("auth:safety response:", response)

        if (!response.success) {
            errorMessage.textContent = response.error || "Invalid access key"
            return
        }

        // Authentication successful - unlock interface
        lockScreen.hidden = true
        racePanel.hidden = false
    })
})

// Allow Enter key to submit
accessKeyInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        unlockBtn.click()
    }
})

// START RACE (FIXED)
startBtn.onclick = () => {
    socket.emit("race:start", (res) => {
        if (!res.success) {
            alert(res.error)
        }
    })
}

// MODES (FIXED lowercase)
safeBtn.onclick = () => setMode("safe")
hazardBtn.onclick = () => setMode("hazard")
dangerBtn.onclick = () => setMode("danger")
finishBtn.onclick = () => setMode("finish")

function setMode(mode) {
    if (raceFinished) return

    socket.emit("race:changeMode", { mode }, (res) => {
        if (!res.success) {
            alert(res.error)
        }
    })
}

// UI UPDATE FROM SERVER (SOURCE OF TRUTH)
socket.on("state:update", (state) => {

    const mode = state.raceMode

    status.innerText = "Mode: " + mode

    if (mode === "safe") status.style.color = "lime"
    if (mode === "hazard") status.style.color = "yellow"
    if (mode === "danger") status.style.color = "red"
    if (mode === "finish") {
        status.style.color = "white"
        raceFinished = true
        endSessionBtn.style.display = "inline"

    }
})

endSessionBtn.onclick = () => {
    socket.emit("race:changeMode", { mode: "reset" })
}


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

startBtn.onclick = () => {

    socket.emit("race:start")

    socket.emit("race:mode:set", "SAFE")

}

safeBtn.onclick = () => setMode("SAFE")
hazardBtn.onclick = () => setMode("HAZARD")
dangerBtn.onclick = () => setMode("DANGER")
finishBtn.onclick = () => setMode("FINISH")

function setMode(mode) {

    if (raceFinished) return

    socket.emit("race:mode:set", mode)

    status.innerText = "Mode: " + mode

    if (mode === "FINISH") {
        raceFinished = true
        endSessionBtn.style.display = "inline"

        safeBtn.disabled = true
        hazardBtn.disabled = true
        dangerBtn.disabled = true
    }

}

function updateStatus(mode) {

    status.innerText = "Mode: " + mode

    if (mode === "SAFE") status.style.color = "lime"
    if (mode === "HAZARD") status.style.color = "yellow"
    if (mode === "DANGER") status.style.color = "red"
    if (mode === "FINISH") status.style.color = "cyan"

}

endSessionBtn.onclick = () => {

    socket.emit("race:endSession")

}

socket.on("state:update", (state) => {

    if (state.raceMode === "FINISH") {

        raceFinished = true
        endSessionBtn.style.display = "inline"

    }

})


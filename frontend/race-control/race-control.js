const socket = io()

let raceFinished = false

const status = document.getElementById("race-status")
const startBtn = document.getElementById("start")
const safeBtn = document.getElementById("safe")
const hazardBtn = document.getElementById("hazard")
const dangerBtn = document.getElementById("danger")
const finishBtn = document.getElementById("finish")
const endSessionBtn = document.getElementById("end-session")

endSessionBtn.style.display = "none"

function askSafetyKey() {

    const key = prompt("Enter SAFETY KEY")

    socket.emit("auth:submit", {
        role: "safety",
        key: key
    })

}

startBtn.onclick = () => {

    askSafetyKey()

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


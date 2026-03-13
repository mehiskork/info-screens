const socket = io()

let raceFinished = false

const startBtn = document.getElementById("startRace")
const safeBtn = document.getElementById("safe")
const hazardBtn = document.getElementById("hazard")
const dangerBtn = document.getElementById("danger")
const finishBtn = document.getElementById("finish")
const endSessionBtn = document.getElementById("endSession")

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

    if (mode === "FINISH") {
        raceFinished = true
        endSessionBtn.style.display = "inline"
    }

}

endSessionBtn.onclick = () => {

    socket.emit("race:endSession",)

}

socket.on("state:update", (state) => {

    if (state.raceMode === "FINISH") {
        raceFinished = true
        endSessionBtn.style.display = "inline"
    }
})


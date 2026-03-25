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

// SAFETY KEY (FIXED)
function askSafetyKey(callback) {
    const key = prompt("Enter SAFETY KEY")

    socket.emit("auth:receptionist", { accessKey: key }, (res) => {
        if (!res.success) {
            alert("Wrong key")
            return
        }
        callback()
    })
}

// START RACE (FIXED)
startBtn.onclick = () => {
    askSafetyKey(() => {

        socket.emit("getNextRace", (res) => {

            if (!res.success) {
                alert("No session available")
                return
            }

            const sessionId = res.data.id

            socket.emit("race:start", { sessionId }, (res) => {
                if (!res.success) {
                    alert(res.error)
                }
            })
        })
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


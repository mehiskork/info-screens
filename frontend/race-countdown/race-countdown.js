const socket = io()
const timer = document.getElementById("timer")

let endTime = null

socket.on("state:update", (state) => {

    if (state.timer?.running) {
        endTime = state.timer.endsAt
    } else {
        endTime = null
        timer.innerText = "00:00"
    }
})

function updateTimer() {
    if (!endTime) return

    const remaining = Math.max(0, endTime - Date.now())

    const min = Math.floor(remaining / 60000)
    const sec = Math.floor((remaining % 60000) / 1000)

    timer.innerText =
        String(min).padStart(2, "0") + ":" +
        String(sec).padStart(2, "0")

    if (remaining <= 0) {
        socket.emit("race:changeMode", { mode: "finish" })
    }
}

setInterval(updateTimer, 1000)
const socket = io()

const timer = document.getElementById("timer")
const fullscreenBtn = document.getElementById("fullscreen")

let endTime = null

fullscreenBtn.onclick = () => {
    document.documentElement.requestFullscreen()
}

socket.on("state:update", (state) => {

    if (state.timer.running) {
        endTime = state.timer.endsAt
    }

})

function updateTimer() {

    if (!endTime) return

    const now = Date.now()

    let remaining = Math.max(0, endTime - now)

    let seconds = Math.floor(remaining / 1000)

    let minutes = Math.floor(seconds / 60)

    seconds = seconds % 60

    timer.innerText =
        String(minutes).padStart(2, "0") + ":" +
        String(seconds).padStart(2, "0")

}

setInterval(updateTimer, 1000)
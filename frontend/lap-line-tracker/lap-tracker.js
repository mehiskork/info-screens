let socket = null
let canTrackLaps = false
let renderedCarsSignature = ""
let finishCompletedCars = new Set()
let currentCarNumbers = []

const lockScreen = document.getElementById("lock-screen")
const authForm = document.getElementById("key-form")
const accessKeyInput = document.getElementById("access-key")
const unlockBtn = document.getElementById("unlock-btn")
const errorMessage = document.getElementById("error-message")

const lapTrackerPanel = document.getElementById("lap-tracker-panel")
const carButtonsContainer = document.getElementById("car-buttons")
const trackerStateMessage = document.getElementById("tracker-state-message")
const lapFeedback = document.getElementById("lap-feedback")

function getConnectionErrorMessage(error, invalidKeyMessage) {
    const message = String(error?.message || "").toLowerCase()

    if (message === "unauthorized" || message === "invalid observer key" || message === "invalid access key") {
        return invalidKeyMessage
    }

    if (message.includes("xhr poll error") || message.includes("websocket error") || message.includes("transport error")) {
        return "Cannot connect to server"
    }

    return "Connection failed. Please try again."
}

function formatTime(ms) {
    if (ms === null || ms === undefined) return "—"
    return `${(ms / 1000).toFixed(2)}s`
}

function setTrackerState(text, variant = "info") {
    trackerStateMessage.textContent = text
    trackerStateMessage.className = `tracker-state ${variant}`
}

function setLapFeedback(text, variant = "") {
    lapFeedback.textContent = text
    lapFeedback.className = variant
}

function isCarButtonDisabled(carNumber) {
    return !canTrackLaps || finishCompletedCars.has(carNumber)
}

function renderCarButtons(carNumbers) {
    carButtonsContainer.innerHTML = ""

    if (carNumbers.length === 0) {
        const emptyState = document.createElement("div")
        emptyState.className = "car-buttons-empty"
        emptyState.textContent = "No active race cars"
        carButtonsContainer.appendChild(emptyState)
        return
    }

    carNumbers.forEach((carNumber) => {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "car-btn"
        button.dataset.car = String(carNumber)
        button.textContent = String(carNumber)
        button.disabled = isCarButtonDisabled(carNumber)

        button.addEventListener("click", () => {
            if (!socket || !socket.connected || isCarButtonDisabled(carNumber)) {
                return
            }

            button.classList.add("pulse")
            setTimeout(() => button.classList.remove("pulse"), 300)

            socket.emit("lap:crossing", { carNumber, timestamp: Date.now() }, (response) => {
                if (!response || !response.success) {
                    setLapFeedback(response?.error || "Failed to record lap", "error")
                    return
                }

                if (response.finishLapCompleted) {
                    finishCompletedCars.add(carNumber)
                    syncCarButtons(currentCarNumbers)
                }

                if (response.message) {
                    setLapFeedback(`Car ${carNumber}: ${response.message}`, "success")
                    return
                }

                setLapFeedback(
                    `Car ${carNumber}: Lap ${response.lap} - ${formatTime(response.lapTime)} (Best: ${formatTime(response.bestTime)})`,
                    "success"
                )
            })
        })

        carButtonsContainer.appendChild(button)
    })
}

function syncCarButtons(carNumbers) {
    const signature = carNumbers.join(",")

    if (signature !== renderedCarsSignature) {
        renderedCarsSignature = signature
        renderCarButtons(carNumbers)
        return
    }

    // Keep disabled state in sync without rebuilding the grid each update tick.
    carButtonsContainer.querySelectorAll(".car-btn").forEach((button) => {
        const carNumber = Number(button.dataset.car)
        button.disabled = isCarButtonDisabled(carNumber)
    })
}

function getFinishCompletedCarsFromRace(race) {
    const completed = new Set()
    const laps = race?.laps || {}

    Object.keys(laps).forEach((carKey) => {
        const carNumber = Number(carKey)
        const lapInfo = laps[carKey]

        if (Number.isInteger(carNumber) && lapInfo && lapInfo.finishLapCompleted === true) {
            completed.add(carNumber)
        }
    })

    return completed
}

function applyLifecycle(payload) {
    const race = payload?.raceStatus
    const hasActiveRace = Boolean(payload?.hasActiveRace && race)

    if (!hasActiveRace) {
        canTrackLaps = false
        finishCompletedCars = new Set()
        currentCarNumbers = []
        syncCarButtons([])
        if (payload?.lastFinishedRace) {
            setTrackerState("Session ended. Waiting for next race.", "warning")
        } else {
            setTrackerState("No active race.", "warning")
        }
        return
    }

    const mode = String(race.mode || "").toLowerCase()
    const carNumbers = (race.drivers || [])
        .map((driver) => Number(driver.carNumber))
        .filter((carNumber) => Number.isInteger(carNumber))
        .sort((a, b) => a - b)

    currentCarNumbers = carNumbers

    canTrackLaps = true

    if (mode === "finish") {
        finishCompletedCars = getFinishCompletedCarsFromRace(race)
    } else {
        finishCompletedCars = new Set()
    }

    syncCarButtons(carNumbers)

    if (mode === "finish") {
        const remaining = carNumbers.filter((carNumber) => !finishCompletedCars.has(carNumber)).length
        if (remaining === 0) {
            setTrackerState(`Active race session ${race.sessionId} — all cars completed final lap. Proceed to paddock.`, "warning")
        } else {
            setTrackerState(`Active race session ${race.sessionId} — FINISH mode. ${remaining} car(s) still need final lap completion.`, "warning")
        }
    } else {
        setTrackerState(`Active race session ${race.sessionId} (${mode.toUpperCase()})`, "success")
    }
}

function attachSocketHandlers(activeSocket) {
    activeSocket.on("connect", () => {
        lockScreen.hidden = true
        lapTrackerPanel.hidden = false
        unlockBtn.disabled = false
        errorMessage.textContent = ""
        setLapFeedback("", "")

        activeSocket.emit("getRaceLifecycle", (response) => {
            if (response?.success) {
                applyLifecycle(response)
            }
        })
    })

    activeSocket.on("connect_error", (error) => {
        unlockBtn.disabled = false
        lockScreen.hidden = false
        lapTrackerPanel.hidden = true
        errorMessage.textContent = getConnectionErrorMessage(error, "Invalid access key")
    })

    activeSocket.on("disconnect", () => {
        canTrackLaps = false
        syncCarButtons([])
        setTrackerState("Disconnected from server.", "warning")
    })

    activeSocket.on("race:lifecycle", applyLifecycle)

    activeSocket.on("race:statusSnapshot", (state) => {
        if (typeof state?.hasActiveRace === "boolean") {
            applyLifecycle(state)
        }
    })

    // race:status omits drivers in backend payload; handling it here caused
    // periodic empty/non-empty button redraw flicker. race:lifecycle + snapshot
    // already provide the required full payload for this screen.

    activeSocket.on("race:sessionEnded", () => {
        canTrackLaps = false
        finishCompletedCars = new Set()
        currentCarNumbers = []
        syncCarButtons([])
        setTrackerState("Session ended. Waiting for next race.", "warning")
    })
}

authForm.addEventListener("submit", (event) => {
    event.preventDefault()

    const accessKey = accessKeyInput.value.trim()
    if (!accessKey) {
        errorMessage.textContent = "Enter access key"
        return
    }

    unlockBtn.disabled = true
    errorMessage.textContent = ""

    if (socket) {
        socket.disconnect()
        socket = null
    }

    socket = io({
        auth: {
            role: "observer",
            accessKey
        }
    })

    attachSocketHandlers(socket)
})

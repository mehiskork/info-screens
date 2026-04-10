let socket = null
let raceFinished = false
let endTime = null
let currentMode = ""
let lastText = ""
let lastMode = null
let lastActive = null
let lastRaceId = null
let cachedNextRace = null
let lastFullRace = null
let uiInitialized = false
let hasInitialState = false
let isAuthed = false

// Lock screen
const lockScreen = document.getElementById("lock-screen")
const accessKeyInput = document.getElementById("access-key")
const unlockBtn = document.getElementById("unlock-btn")
const errorMessage = document.getElementById("error-message")

// Race panel
const racePanel = document.getElementById("race-panel")
const status = document.getElementById("race-status")
const startBtn = document.getElementById("start")
const safeBtn = document.getElementById("safe")
const hazardBtn = document.getElementById("hazard")
const dangerBtn = document.getElementById("danger")
const finishBtn = document.getElementById("finish")
const endSessionBtn = document.getElementById("end-session")
const miniTimer = document.getElementById("mini-timer")
const lights = document.querySelectorAll(".mini-light")

//document.querySelectorAll(".mini-light")

// Info areas
const nextRaceEl = document.getElementById("next-race")

racePanel.style.display = "none"
endSessionBtn.style.display = "none"

// AUTH
const form = document.getElementById("key-form")

form.addEventListener("submit", (e) => {
    e.preventDefault()

    const accessKey = accessKeyInput.value.trim()

    if (!accessKey) {
        errorMessage.textContent = "Enter access key"
        return
    }

    if (socket) socket.disconnect()

    socket = io({
        auth: {
            role: "safety",
            accessKey: accessKey
        }
    })

    socket.on("connect_error", (err) => {

        if (isAuthed) {
            showLockScreen("Server disconnected")
            return
        }

        if (err.message === "xhr poll error") {
            errorMessage.textContent = "Cannot connect to server"
        } else {
            errorMessage.textContent = "Invalid access key"
        }
    })

    socket.on("connect", () => {
        isAuthed = true

        errorMessage.textContent = ""
        clearError()

        showRacePanel()

        setupSocketEvents()

        socket.emit("race:getStatus")
    })

    socket.on("disconnect", () => {
        hasInitialState = false

        showLockScreen("Server disconnected")


        lastMode = null
        lastActive = null
        lastRaceId = null
    })


    // SAFE EMIT
    function emitSafe(event, data, callback) {
        if (!socket || !socket.connected) {
            showError("Not connected")
            return
        }
        socket.emit(event, data, callback)
    }

    // BUTTONS
    let lightsReady = false

    startBtn.onclick = () => {

        if (!lightsReady) {
            socket.emit("startLights:begin")
            startBtn.disabled = true
            return
        }

        // SECOND CLICK (only when ready)
        socket.emit("startLights:go")

        socket.emit("getNextRace", (res) => {
            if (!res?.success) {
                showError("No upcoming race")
                return
            }

            const race = res.data

            emitSafe("race:start", { sessionId: race.id }, (res) => {
                if (!res.success) showError(res.error)
            })
        })

        lightsReady = false
    }

    safeBtn.onclick = () => setMode("safe")
    hazardBtn.onclick = () => setMode("hazard")
    dangerBtn.onclick = () => setMode("danger")
    finishBtn.onclick = () => setMode("finish")

    function setMode(mode) {
        if (raceFinished) return

        emitSafe("race:changeMode", { mode }, (res) => {
            //console.log("MODE:", mode, res)
            if (!res.success) showError(res.error)
        })
    }

    // END SESSION
    endSessionBtn.onclick = () => {
        if (!socket || !socket.connected) return

        socket.emit("race:endSession", (res) => {
            console.log("END SESSION:", res)
            if (!res.success) showError(res.error)
        })
    }



    // SOCKET EVENTS
    function setupSocketEvents() {

        socket.on("race:statusSnapshot", (state) => {
            hasInitialState = true

            showRacePanel()

            const s = state?.raceStatus

            if (!s) {
                setIdle()
                updateUIState(false, "")
                return
            }

            handleState(s)

            if (s.active) {
                renderCurrentRace(s)
            } else {
                setIdle()
            }

            updateUIState(s.active, s.mode)
        })


        socket.on("race:status", (state) => {
            const s = state?.raceStatus || state
            if (!s) return

            handleState(s)

            if (s.active) {
                const entries = s.entries || s.drivers || []

                if (entries.length) {
                    renderCurrentRace(s)
                }
            }
        })


        socket.on("race:modeChanged", (state) => {
            handleState(state?.raceStatus || state)
        })


        socket.on("startLights:begin", () => {
            showLights()
            resetLights()
        })

        socket.on("startLights:step", (step) => {
            lights[step - 1].classList.add("on")

            if (step === 5) {
                lightsReady = true
                startBtn.disabled = false
            }
        })

        socket.on("startLights:go", () => {
            goLights()

            setTimeout(() => {
                hideLights()
            }, 2500)
        })

        socket.on("race:finished", () => {
            raceFinished = true
        })

        socket.on("race:sessionEnded", () => {
            raceFinished = false
            lastActive = false
            setIdle()
            updateUIState(false, "")
        })

        socket.on("nextRace:changed", () => {
            socket.emit("getNextRace", (res) => {
                if (!res?.success || !res.data) {
                    cachedNextRace = null
                    renderNextRace(null)
                    return
                }

                cachedNextRace = res.data

                const entries = res.data.entries || res.data.drivers || []

                if (entries.length > 0) {
                    clearError()
                }

                if (!lastActive) {
                    renderNextRace(cachedNextRace)
                }
            })
        })
    }

    // STATE
    function handleState(state) {
        if (!state) return

        const isActive = state.active ?? state.hasActiveRace
        const mode = (state.mode || state.raceMode || "").toLowerCase()

        const raceId = state.id || state.sessionId

        if (
            mode === lastMode &&
            isActive === lastActive &&
            raceId === lastRaceId
        ) return

        lastMode = mode
        lastActive = isActive
        lastRaceId = raceId

        currentMode = mode

        if (isActive === false) {
            setIdle()
            updateUIState(false, "")
            return
        }

        if (status.textContent !== mode.toUpperCase()) {
            status.textContent = mode.toUpperCase()
        }


        if (mode === "safe") status.style.color = "#32cd32"
        else if (mode === "hazard") status.style.color = "yellow"
        else if (mode === "danger") status.style.color = "red"
        else if (mode === "finish") status.style.color = "white"

        if (state.startTime && state.totalDuration) {
            endTime = Number(state.startTime) + Number(state.totalDuration) * 1000
        }

        updateUIState(isActive, mode)
    }

    function setIdle() {

        if (lastActive === true) return

        lastActive = false

        status.innerText = "No active race"
        status.style.color = "red"

        raceFinished = false
        endTime = null


        loadNextRace()
    }

    // CURRENT RACE
    function renderCurrentRace(race) {
        const titleEl = document.getElementById("next-race-title")
        const listEl = document.getElementById("next-race-list")

        if (!titleEl || !listEl) return

        titleEl.innerText = ""
        listEl.innerHTML = ""
    }

    // NEXT RACE
    function loadNextRace() {

        if (!hasInitialState) return

        if (lastActive === true) return

        if (!socket) return

        socket.emit("getNextRace", (res) => {
            if (!res?.success || !res.data) {
                cachedNextRace = null
                renderNextRace(null)
                return
            }

            cachedNextRace = res.data
            renderNextRace(cachedNextRace)
        })
    }



    // TIMER
    function updateTimer() {
        if (!endTime || currentMode === "finish") {
            if (lastText !== "00:00.00") {
                miniTimer.innerText = "00:00.00"
                lastText = "00:00.00"
            }
            return
        }

        const remaining = Math.max(0, endTime - Date.now())

        const min = Math.floor(remaining / 60000)
        const sec = Math.floor((remaining % 60000) / 1000)
        const hund = Math.floor((remaining % 1000) / 10)

        const text =
            String(min).padStart(2, "0") + ":" +
            String(sec).padStart(2, "0") + "." +
            String(hund).padStart(2, "0")

        if (text !== lastText) {
            miniTimer.innerText = text
            lastText = text
        }
    }

    function startTimerLoop() {
        function loop() {
            updateTimer()
            requestAnimationFrame(loop)
        }
        requestAnimationFrame(loop)
    }

    startTimerLoop()

    // UI
    function updateUIState(hasActiveRace, mode) {


        startBtn.style.display = "none"
        safeBtn.style.display = "none"
        hazardBtn.style.display = "none"
        dangerBtn.style.display = "none"
        finishBtn.style.display = "none"
        endSessionBtn.style.display = "none"

        toggleNextRace(false)

        if (!hasActiveRace) {
            startBtn.style.display = "block"
            toggleNextRace(true)
            return
        }

        if (mode === "finish") {
            endSessionBtn.style.display = "block"
            toggleNextRace(false)
            return
        }



        safeBtn.style.display = "block"
        hazardBtn.style.display = "block"
        dangerBtn.style.display = "block"
        finishBtn.style.display = "block"
    }

    function renderNextRace(race) {


        if (lastActive === true) return

        const titleEl = document.getElementById("next-race-title")
        const listEl = document.getElementById("next-race-list")

        if (!titleEl || !listEl) return

        listEl.innerHTML = ""

        if (!race) {
            titleEl.innerText = "No upcoming race"

            startBtn.classList.add("disabled")
            startBtn.disabled = true

            showError("Cannot start race with no drivers")
            return
        }

        clearError()

        startBtn.classList.remove("disabled")
        startBtn.disabled = false

        titleEl.innerText = "Next: " + (race.name || "Session " + race.id)

        const entries = race.entries || race.drivers || []

        entries.forEach(e => {
            const row = document.createElement("div")
            row.className = "driver-row"

            row.innerHTML = `
            <div class="driver-badge">Car ${e.carNumber || "-"}</div>
            <div class="driver-name">${e.driverName || e.name || "Driver"}</div>
        `

            listEl.appendChild(row)
        })
    }

    function toggleNextRace(show) {
        if (!nextRaceEl) return
        nextRaceEl.style.display = show ? "block" : "none"
    }

    function showError(msg) {
        const el = document.getElementById("panel-error")
        el.innerText = msg
        el.style.display = "block"
    }

    function clearError() {
        const el = document.getElementById("panel-error")
        el.style.display = "none"
    }

    function showLockScreen(message = "") {
        lockScreen.style.display = "block"
        racePanel.style.display = "none"

        if (message) {
            errorMessage.textContent = message
        }
    }

    function showRacePanel() {
        lockScreen.style.display = "none"
        racePanel.style.display = "block"
    }


    function resetLights() {
        lights.forEach(l => l.classList.remove("on", "go"))
    }

    function goLights() {
        lights.forEach(l => {
            l.classList.remove("on")
            l.classList.add("go")
        })
    }


    function showLights() {
        document.getElementById("mini-lights").style.display = "flex"
    }

    function hideLights() {
        const el = document.getElementById("mini-lights")
        el.classList.add("hidden")

        setTimeout(() => {
            el.style.display = "none"
            el.classList.remove("hidden")
        }, 400)
    }

})
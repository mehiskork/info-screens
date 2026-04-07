window.createRaceTimerModel = function ({ onTick = () => { }, showHundredths = false } = {}) {
    let endTime = null
    let active = false
    let mode = "danger"
    let frameId = null
    let lastText = ""

    function getRemainingMs() {
        if (!active || mode === "finish" || !endTime) {
            return 0
        }
        return Math.max(0, endTime - Date.now())
    }

    function format(remainingMs) {
        const min = Math.floor(remainingMs / 60000)
        const sec = Math.floor((remainingMs % 60000) / 1000)

        if (!showHundredths) {
            return String(min).padStart(2, "0") + ":" + String(sec).padStart(2, "0")
        }

        const hund = Math.floor((remainingMs % 1000) / 10)
        return (
            String(min).padStart(2, "0") + ":" +
            String(sec).padStart(2, "0") + "." +
            String(hund).padStart(2, "0")
        )
    }

    function emit() {
        const remainingMs = getRemainingMs()
        const text = format(remainingMs)

        if (text !== lastText) {
            lastText = text
            onTick({ text, remainingMs, active, mode })
        }
    }

    function applyState(state) {
        if (!state) {
            return
        }

        const race = state.raceStatus || state.race || state
        if (!race) {
            return
        }

        const nextMode = (race.mode || state.raceMode || "").toLowerCase()
        if (nextMode) {
            mode = nextMode
        }

        const hasExplicitActive =
            typeof race.active === "boolean" ||
            typeof state.hasActiveRace === "boolean"

        if (hasExplicitActive) {
            active = typeof race.active === "boolean" ? race.active : state.hasActiveRace
        } else if (race.sessionId) {
            active = true
        }

        if (!active || mode === "finish") {
            endTime = null
            emit()
            return
        }

        if (race.startTime && race.totalDuration) {
            endTime = race.startTime + race.totalDuration * 1000
        } else if (Number.isFinite(race.secondsRemaining)) {
            endTime = Date.now() + race.secondsRemaining * 1000
        }

        emit()
    }

    function start() {
        if (frameId !== null) {
            return
        }

        function loop() {
            emit()
            frameId = window.requestAnimationFrame(loop)
        }

        frameId = window.requestAnimationFrame(loop)
    }

    function stop() {
        if (frameId === null) {
            return
        }
        window.cancelAnimationFrame(frameId)
        frameId = null
    }

    function reset() {
        active = false
        mode = "danger"
        endTime = null
        emit()
    }

    return {
        applyState,
        start,
        stop,
        reset
    }
}
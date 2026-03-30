const fullScreenBtn = document.getElementById("fullscreen-btn");
const raceCard = document.getElementById("race-card");
const sessionTitle = document.getElementById("session-title");
const driversList = document.getElementById("drivers-list");
const emptyState = document.getElementById("empty-state");
const paddockMessage = document.getElementById("paddock-message");
const flagStatus = document.getElementById("flag-status");
const timerDisplay = document.getElementById("timer-display");


let currentMode = null;
let secondsRemaining = null;

function getRaceFromPayload(payload = {}) {
    return payload.raceStatus || payload.race || payload;
}

function normalizeMode(mode) {
    const map = {
        safe: "Safe",
        hazard: "Hazard",
        danger: "Danger",
        finish: "Finish",
        finished: "Finish"
    };
    return map[String(mode || "").toLowerCase()] || "Waiting";
}

function applyRacePayload(payload = {}) {
    const race = getRaceFromPayload(payload);

    currentMode = race.mode ?? currentMode;

    if (typeof race.secondsRemaining === "number") {
        secondsRemaining = race.secondsRemaining;
    } else if (race.startTime != null && race.totalDuration != null) {
        const startMs =
            typeof race.startTime === "number"
                ? race.startTime
                : new Date(race.startTime).getTime();

        const endTime = startMs + race.totalDuration * 1000;
        secondsRemaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    } else {
        secondsRemaining = null;
    }

    renderFlag();
    renderTimer();
}

function renderTimer() {
    if (secondsRemaining == null) {
        timerDisplay.textContent = "Timer: --:--";
        return;
    }

    const min = String(Math.floor(secondsRemaining / 60)).padStart(2, "0");
    const sec = String(secondsRemaining % 60).padStart(2, "0");
    timerDisplay.textContent = `Timer: ${min}:${sec}`;
}

setInterval(() => {
    if (secondsRemaining != null && secondsRemaining > 0) {
        secondsRemaining -= 1;
        renderTimer();
    }
}, 1000);



function renderFlag() {
    const mode = String(currentMode || "").toLowerCase();

    flagStatus.textContent = `Flag: ${normalizeMode(mode)}`;

    flagStatus.style.background = "";
    flagStatus.style.color = "white";
    flagStatus.style.textShadow = "none";
    flagStatus.style.fontWeight = "600";

    if (mode === "safe") {
        flagStatus.style.background = "green";
    } else if (mode === "hazard") {
        flagStatus.style.background = "yellow";
        flagStatus.style.color = "black";
    } else if (mode === "danger") {
        flagStatus.style.background = "red";
    } else if (mode === "finish" || mode === "finished") {
        flagStatus.style.background =
            "repeating-conic-gradient(black 0% 25%, white 0% 50%) 0 0 / 80px 80px";
        flagStatus.style.color = "black";
    } else {
        flagStatus.style.background = "";
        flagStatus.style.color = "white";
    }
}


// checks if fullscreen or not and names the button
function updateFullscreenButton() {


    if (document.fullscreenElement) {
        fullScreenBtn.textContent = "Exit Fullscreen";
    } else {
        fullScreenBtn.textContent = "Fullscreen";
    }
}

fullScreenBtn.addEventListener("click", async () => {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    } catch (err) {
        console.error("Fullscreen error:", err);
    }
});

//Whenever fullscreen state changes, update the button text. esc is used
document.addEventListener("fullscreenchange", updateFullscreenButton);
updateFullscreenButton();




const socket = createSocket();

socket.on("race:statusSnapshot", applyRacePayload);
socket.on("race:status", applyRacePayload);
socket.on("race:modeChanged", applyRacePayload);
socket.on("race:finished", applyRacePayload);





socket.on("race:sessionEnded", () => {
    currentMode = "danger";
    secondsRemaining = null;
    renderFlag();
    renderTimer();
});

// listens for a connect event and loads next race if successful
socket.on("connect", () => {
    loadNextRace();
});

socket.on("nextRace:changed", () => {
    console.log("nextRace:changed received");
    loadNextRace();
});



function loadNextRace() {
    socket.emit("getNextRace", (response) => {
        console.log("getNextRace response:", response);

        if (!response.success) {
            showState("empty");
            return;
        }

        showState(response.state || "upcoming", response.data);
    });
}

// put the page into no upcoming race mode
function showEmptyState() {
    emptyState.hidden = false;
    raceCard.hidden = true;
    paddockMessage.hidden = true;
    sessionTitle.textContent = "";
    driversList.innerHTML = "";
}

function renderDriverRow(driver) {
    const row = document.createElement("div");
    row.className = "driver-row";

    row.innerHTML = `
        <span class="driver-badge">Car ${driver.carNumber}</span>
        <span class="driver-name">${driver.name}</span>
    `;

    return row
}

function showUpcomingState(session) {
    emptyState.hidden = true;
    raceCard.hidden = false;
    paddockMessage.hidden = true;

    sessionTitle.textContent = `Session ${session.id}`;
    // clears the current contents of driversList
    driversList.innerHTML = "";


    // loops through each driver and creates a row
    session.drivers.forEach((driver) => {
        const row = renderDriverRow(driver);
        driversList.appendChild(row);

    });
}

function showPaddockState(session) {
    emptyState.hidden = true;
    raceCard.hidden = false;
    paddockMessage.hidden = false;

    sessionTitle.textContent = `Session ${session.id}`;
    driversList.innerHTML = "";

    session.drivers.forEach((driver) => {
        const row = renderDriverRow(driver);
        driversList.appendChild(row);
    });
}

function showState(state, session = null) {
    if (state === "empty") return showEmptyState();
    if (state === "upcoming" && session) return showUpcomingState(session);
    if (state === "paddock" && session) return showPaddockState(session);

    showEmptyState();


}


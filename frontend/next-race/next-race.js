const fullScreenBtn = document.getElementById("fullscreen-btn");
const raceCard = document.getElementById("race-card");
const sessionTitle = document.getElementById("session-title");
const driversList = document.getElementById("drivers-list");
const emptyState = document.getElementById("empty-state");
const paddockMessage = document.getElementById("paddock-message");
const flagStatus = document.getElementById("flag-status");
const timerDisplay = document.getElementById("timer-display");

// storing vurrent race mode
let currentMode = null;

//storing current remaining time
let secondsRemaining = null;


// helper function to extract the “race object” from incoming messages.
function getRaceFromPayload(payload = {}) {
    return payload.raceStatus || payload.race || payload;
}

// converts internal mode values into a clean display string for the UI
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


// takes payload and updateslocal UI state (currentMode, secondsRemaining)
function applyRacePayload(payload = {}) {
    const race = getRaceFromPayload(payload);

    // Updates currentMode if race.mode exists
    currentMode = race.mode ?? currentMode;

    // converts currentMode to a lowercase string
    const mode = String(currentMode || "").toLowerCase();

    // compute secondsRemaining 
    if (mode === "finish" || mode === "finished") {
        secondsRemaining = 0;
    } else if (typeof race.secondsRemaining === "number") {
        secondsRemaining = race.secondsRemaining;
    } else if (race.startTime != null && race.totalDuration != null) {


        const startMs = typeof race.startTime === "number"
            // if race.startTime is already a number use it directly
            ? race.startTime
            // otherwise assume its a date string
            : new Date(race.startTime).getTime();

        const endTime = startMs + race.totalDuration * 1000;

        // Calculates how many seconds remain until endTime.
        secondsRemaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    } else {
        secondsRemaining = null;
    }

    renderFlag();
    renderTimer();
}


// updates timerDisplay based on the current value of secondsRemaining.
function renderTimer() {
    if (secondsRemaining == null) {
        timerDisplay.textContent = "00:00";
        return;
    }

    // .padStart(2, "0") ensures it’s always 2 digits (e.g. 3 becomes "03").
    const min = String(Math.floor(secondsRemaining / 60)).padStart(2, "0");
    const sec = String(secondsRemaining % 60).padStart(2, "0");
    timerDisplay.textContent = `${min}:${sec}`;
}


// run the callback function over and over until the page is closed
setInterval(() => {
    if (secondsRemaining != null && secondsRemaining > 0) {
        secondsRemaining -= 1;
        renderTimer();
    }
}, 1000);


// updates the flag UI based on the current race mode stored in currentMode.
function renderFlag() {
    const mode = String(currentMode || "").toLowerCase();
    flagStatus.textContent = normalizeMode(mode).toUpperCase();

    flagStatus.style.background = "";
    flagStatus.style.color = "black";

    if (mode === "safe") {
        flagStatus.style.background = "green";
    } else if (mode === "hazard") {
        flagStatus.style.background = "yellow";
    } else if (mode === "danger") {
        flagStatus.style.background = "red";
    } else if (mode === "finish" || mode === "finished") {
        flagStatus.style.background =
            "repeating-conic-gradient(black 0% 25%, white 0% 50%) 0 0 / 20px 20px";
        flagStatus.style.color = "red";
    }
}


function updateFullscreenButton() {
    fullScreenBtn.hidden = !!document.fullscreenElement;
}

document.addEventListener("fullscreenchange", updateFullscreenButton);
updateFullscreenButton();

fullScreenBtn.addEventListener("click", async () => {
    if (document.fullscreenElement) return;

    try {
        await document.documentElement.requestFullscreen();
    } catch (err) {
        console.error("Fullscreen error:", err);
    }
});


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


// ask the server what the next race is, then update the screen.
function loadNextRace() {
    socket.emit("getNextRace", (response) => {
        console.log("getNextRace response:", response);

        if (!response.success) {
            showState("empty");
            return;
        }

        showState(response.state || "upcoming", response.data, Boolean(response.paddock));
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

// takes one driver object and returns a DOM element representing that driver in the UI.
function renderDriverRow(driver) {
    const row = document.createElement("div");
    row.className = "driver-row";

    row.innerHTML = `
        <span class="driver-badge">Car ${driver.carNumber}</span>
        <span class="driver-name">${driver.name}</span>
    `;

    return row
}


// updates the Next Race screen to show an upcoming session.
function showUpcomingState(session, showPaddock = false) {
    emptyState.hidden = true;
    raceCard.hidden = false;
    paddockMessage.hidden = !showPaddock;

    sessionTitle.textContent = `Session ${session.id}`;
    // clears the current contents of driversList
    driversList.innerHTML = "";


    // loops through each driver and creates a row
    session.drivers.forEach((driver) => {
        const row = renderDriverRow(driver);
        driversList.appendChild(row);

    });
}

// chooses which UI view to show on the Next Race screen.
function showState(state, session = null, showPaddock = false) {
    if (state === "empty") return showEmptyState();
    if (state === "upcoming" && session) return showUpcomingState(session, showPaddock);

    showEmptyState();


}


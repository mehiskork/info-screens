const fullScreenBtn = document.getElementById("fullscreen-btn");
const raceCard = document.getElementById("race-card");
const sessionTitle = document.getElementById("session-title");
const driversList = document.getElementById("drivers-list");
const emptyState = document.getElementById("empty-state");
const paddockMessage = document.getElementById("paddock-message");

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


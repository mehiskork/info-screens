const fullScreenBtn = document.getElementById("fullscreen-btn");
const raceCard = document.getElementById("race-card");
const sessionTitle = document.getElementById("session-title");
const driversList = document.getElementById("drivers-list");
const emptyState = document.getElementById("empty-state");

fullScreenBtn.addEventListener("click", async () => {
    if (!document.fullscreenElement) {

        //document.documentElement means the root HTML element, basically the whole page
        await document.documentElement.requestFullscreen();
    }
});

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


        // checks if request fails or there is no data
        if (!response.success || !response.data) {
            showEmptyState();
            return;
        }

        // sends data to renderNextRace
        renderNextRace(response.data);
    })
}

// put the page into no upcoming race mode
function showEmptyState() {
    emptyState.hidden = false;
    raceCard.hidden = true;
}

function renderDriverRow(driver) {
    const row = document.createElement("div");
    row.className = "driver-row";

    row.innerHTML = `
        <div class="car-badge">Car ${driver.carNumber}</div>
        <div class="driver-name">${driver.name}</div>
    `;

    return row
}

function renderNextRace(session) {
    emptyState.hidden = true;
    raceCard.hidden = false;
    sessionTitle.textContent = `Session ${session.id}`;
    // clears the current contents of driversList
    driversList.innerHTML = "";


    // loops through each driver and creates a row
    session.drivers.forEach((driver) => {
        const row = renderDriverRow(driver);
        driversList.appendChild(row);

    });
}
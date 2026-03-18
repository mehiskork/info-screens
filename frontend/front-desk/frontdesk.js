const keyForm = document.getElementById("key-form");
const accessKeyInput = document.getElementById("access-key");
const errorMessage = document.getElementById("error-message");
const lockScreen = document.getElementById("lock-screen");
const frontDeskApp = document.getElementById("front-desk-app");
const addSessionBtn = document.getElementById("add-session-btn");
const sessionsContainer = document.getElementById("sessions-container");



const MOCK_KEY = "1";
let socket = null;

keyForm.addEventListener("submit", (e) => {

    // Do not do the browser’s normal form submit behavior. Let my JavaScript handle it.
    e.preventDefault();

    //Reads the current text inside the input box and saves it in accessKey.
    const accessKey = accessKeyInput.value.trim();

    // clears old error text
    errorMessage.textContent = "";


    // checks if accessKey is correc
    if (accessKey !== MOCK_KEY) {
        errorMessage.textContent = "Invalid access key";
        return;
    }
    // Guard against reconnecting twice
    if (socket) return;

    lockScreen.hidden = true;
    frontDeskApp.hidden = false;



    // Calls the helper from shared/socket.js.
    socket = createSocket();

    //Server, give me sessions, and when you answer, run this code
    socket.on("connect", () => {

        console.log("socket connected");
        loadSessions();
    });

    socket.on("connect_error", (err) => {
        console.log("connect_error:", err.message);
        errorMessage.textContent = err.message || "Connection failed";
    });

});

function renderSessions(sessions) {
    sessionsContainer.innerHTML = "";

    // Loops through each session in the array and creates a card for each
    sessions.forEach((session) => {
        const card = document.createElement("div");
        card.className = "session-card";

        card.innerHTML = `
        <h3>Session ${session.id}</h3>
        

        <form class="driver-form">
         <input class="driver-name-input" type="text" placeholder="Enter driver´s name" />
         <button type="submit">Add Driver</button>
         </form>

        <p class="drivers-error"></p>
        <div class="drivers-container"></div>

        <button class= "rmv-session-btn" type=button>Remove Session</button>
        `;

        const driverForm = card.querySelector(".driver-form")
        const driverNameInput = card.querySelector(".driver-name-input")
        const driversError = card.querySelector(".drivers-error")

        driverForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const driverName = driverNameInput.value.trim();

            // if name of the driver is not inserted, throw error
            if (driverName === "") {
                driversError.textContent = "Enter the name of the driver";
                return;
            }

            driversError.textContent = "";
            console.log("sending driver:add", session.id, driverName);


            socket.emit("driver:add", { sessionId: session.id, driverName }, (response) => {
                console.log("driver: add response:", response);

                if (!response.success) {
                    driversError.textContent = response.error || "Could not add driver";
                    return;
                }

                loadSessions();
            });
        });

        const driversContainer = card.querySelector(".drivers-container")

        session.drivers.forEach((driver) => {
            const row = document.createElement("div");
            row.className = "driver-row";
            row.innerHTML = `
            <span>Car ${driver.carNumber} - ${driver.name}</span>
            <button class = "edit-driver-btn" type="button">Edit</button>
            <button class = "rmv-driver-btn" type="button">Remove</button>
            `;

            const rmvDriverBtn = row.querySelector(".rmv-driver-btn")

            rmvDriverBtn.addEventListener("click", () => {
                console.log("sending driver: remove", session.id, driver.name);

                // sends Socket.IO driver:remove event to backend
                socket.emit("driver:remove", {
                    sessionId: session.id,
                    driverName: driver.name
                }, (response) => {
                    console.log("driver:remove response:", response);

                    if (!response.success) {
                        errorMessage.textContent = response.error || "Could not remove driver"
                        return;
                    }

                    loadSessions();
                });
            });

            const editDriverBtn = row.querySelector(".edit-driver-btn")

            editDriverBtn.addEventListener("click", () => {

                row.innerHTML = `
                <span>Car ${driver.carNumber}</span>
                <input class="edit-driver-input" type="text" value="${driver.name}">
                <button class="save-driver-btn" type="button">Save</button>
                <button class="cancel-driver-btn" type="button">Cancel</button>
                `;

                const editInput = row.querySelector(".edit-driver-input");
                const saveBtn = row.querySelector(".save-driver-btn");
                const cancelBtn = row.querySelector(".cancel-driver-btn");

                cancelBtn.addEventListener("click", loadSessions);

                saveBtn.addEventListener("click", () => {
                    const newDriverName = editInput.value.trim();

                    if (newDriverName === "") {
                        driversError.textContent = "Enter the name of the driver";
                        return;
                    }

                    driversError.textContent = "";

                    socket.emit("driver:update", {
                        sessionId: session.id,
                        carNumber: driver.carNumber,
                        newDriverName
                    }, (response) => {
                        console.log("driver:update response:", response);

                        if (!response.success) {
                            driversError.textContent = response.error || "Could not update driver";
                            return;
                        }

                        loadSessions();

                    });
                });
            });


            driversContainer.appendChild(row);

        });

        const rmvSessionBtn = card.querySelector(".rmv-session-btn")

        rmvSessionBtn.addEventListener("click", () => {
            console.log("sending session:remove", session.id);

            socket.emit("session:remove", { sessionId: session.id }, (response) => {
                console.log("session:remove response:", response);

                if (!response.success) {
                    errorMessage.textContent = response.error || "Could not remove session";
                    return;
                }

                loadSessions();


            })
        })
        sessionsContainer.appendChild(card);
    })
}

function loadSessions() {
    if (!socket) {
        console.log("No socket yet");
        return;
    }

    socket.emit("getSessions", (response) => {
        console.log("getSessions response:", response);

        if (!response.success) {
            errorMessage.textContent = response.error || "Could not load sessions";
            return;
        }

        renderSessions(response.sessions);
    });
}

addSessionBtn.addEventListener("click", () => {
    if (!socket) {
        errorMessage.textContent = "Connect first";
        return;
    }

    console.log("sending session:add");

    socket.emit("session:add", (response) => {
        console.log("session:add response:", response);


        if (!response.success) {
            errorMessage.textContent = response.error || "Could not add session";
            return;
        }

        loadSessions();

    });

})






















/*
let sessionCount = 0;


addSessionBtn.addEventListener("click", () => {
    sessionCount += 1;

    const sessionCard = document.createElement("div");
    sessionCard.className = "session-card";

    // insert HTML markup as a string
    sessionCard.innerHTML = `
        <!-- Session title-->
        <h3>Session ${sessionCount}</h3>

        <!--Placeholder until drivers are added-->
        <p class="no-drivers-text">No drivers yet</p>

        <form class="driver-input">
         <input class="input2" type="text" placeholder="Enter driver´s name" />
         <button class="add-driver-btn" type="submit">Add Driver</button>
         </form>

        <p class="drivers-error"></p>
        <div class="drivers-container"></div>

       

        <!-- adds remove session and add driver button to every session-->
        <button class="rmv-session-btn" type="button">Remove Session</button>
        

        `;

    //finds the button inside that one card
    const rmvSessionBtn = sessionCard.querySelector(".rmv-session-btn")

    rmvSessionBtn.addEventListener("click", () => {
        sessionCard.remove();

    })


    const noDriversText = sessionCard.querySelector(".no-drivers-text")
    const driversContainer = sessionCard.querySelector(".drivers-container")
    const driversError = sessionCard.querySelector(".drivers-error")
    const driverInput = sessionCard.querySelector(".driver-input");
    const driverNameInput = sessionCard.querySelector(".input2")



    let driverCount = 0;
    const driverArr = [];



    driverInput.addEventListener("submit", (e) => {


        // prevents usual submit reaction and uses js
        e.preventDefault();


        const driverName = driverNameInput.value.trim();
        const normalizedName = driverName.toLowerCase();

        // removes errors if there were before
        driversError.textContent = "";



        // checks if the submit line is empty
        if (driverName === "") {

            driversError.textContent = "Enter the name of the driver"
            return;

        }


        // checks for duplicate names

        for (let i = 0; i < driverArr.length; i++) {

            if (normalizedName === driverArr[i]) {
                driversError.textContent = "Name already in use";
                return;

            }

        }


        // adds driver if there is not 8 already
        if (driverCount < 8) {

            // remove placeholder
            noDriversText.remove();
            driverCount += 1;

            const driverRow = document.createElement("div")

            function showNormalRow(displayName) {

                driverRow.innerHTML = `
                     <p class="driver">${displayName}</p>
                     <button class="edit-driver-btn" type="button">Edit</button>
                     <button class="rmv-driver-btn" type="button">Remove</button> `;

                const editDriverBtn = driverRow.querySelector(".edit-driver-btn");
                const rmvDriverBtn = driverRow.querySelector(".rmv-driver-btn");

                editDriverBtn.addEventListener("click", () => {
                    showEditRow(displayName);
                });

                rmvDriverBtn.addEventListener("click", () => {
                    driverRow.remove();
                    driverCount -= 1;

                    const driverIndex = driverArr.indexOf(displayName.trim().toLowerCase());
                    driverArr.splice(driverIndex, 1);

                    if (driverCount === 0) {
                        driversContainer.appendChild(noDriversText);
                    }
                });
            }


            function showEditRow(displayName) {
                driverRow.innerHTML = `
             <input class="edit-driver-input" type="text" value="${displayName}">
             <button class="save-driver-btn" type="button">Save</button>
             <button class="cancel-driver-btn" type="button">Cancel</button>
             `;
                const editInput = driverRow.querySelector(".edit-driver-input");
                const cancelBtn = driverRow.querySelector(".cancel-driver-btn");
                const saveBtn = driverRow.querySelector(".save-driver-btn");

                cancelBtn.addEventListener("click", () => {
                    showNormalRow(displayName);
                });

                saveBtn.addEventListener("click", () => {
                    const newName = editInput.value.trim();
                    const newNormalized = newName.toLowerCase();
                    const oldNormalized = displayName.toLowerCase();


                    if (newName === "") {
                        driversError.textContent = "Enter the name of the driver";
                        return;
                    }

                    for (let i = 0; i < driverArr.length; i++) {
                        if (driverArr[i] === newNormalized && newNormalized !== oldNormalized) {
                            driversError.textContent = "Name already in use";
                            return;
                        }

                    }

                    driversError.textContent = "";

                    const driverIndex = driverArr.indexOf(oldNormalized);
                    driverArr.splice(driverIndex, 1);
                    driverArr.push(newNormalized);

                    showNormalRow(newName);
                });
            }

            driverRow.className = "driver-row"

            showNormalRow(driverName);


            // adds name to array for checking duplicates
            driverArr.push(normalizedName);
            console.log(driverArr);

            driversContainer.appendChild(driverRow);

            // clears name from the input
            driverNameInput.value = "";

        } else {

            driversError.textContent = "Maximum 8 drivers per session";

        }

    });


    sessionsContainer.appendChild(sessionCard);

});
*/




const keyForm = document.getElementById("key-form");
const accessKeyInput = document.getElementById("access-key");
const errorMessage = document.getElementById("error-message");
const lockScreen = document.getElementById("lock-screen");
const frontDeskApp = document.getElementById("front-desk-app");
const addSessionBtn = document.getElementById("add-session-btn");
const sessionsContainer = document.getElementById("sessions-container");


// holds Socket.IO connection object
let socket = null;
const MAX_DRIVER_NAME_LENGTH = 25;

// A flag to prevent attaching the same socket listener multiple times.
let queueListenerAttached = false;

// whether the user has successfully authenticated at least once in this tab session.
let isAuthed = false;


//enables/disables lock screen inputs
function setFormEnabled(enabled) {
    accessKeyInput.disabled = !enabled;
    keyForm.querySelector("button[type='submit']").disabled = !enabled;
}



// all names uppercase when adding a driver. Can change in edit if needed
function formatDriverName(name) {
    return name
        .trim()
        //Splits the string into an array of words. /s = any whitespace character
        .split(/\s+/)
        .map((word) => {

            //first character uppercase, rest lowercase
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(" ");
}


// attach Socket.IO event listeners related to the race queue

function attachQueueListeners() {
    if (!socket || queueListenerAttached) return;

    queueListenerAttached = true;

    // when the backend emits nextRace:changed, run this function
    socket.on("nextRace:changed", () => {
        console.log("nextRace:changed received");
        loadSessions();
    });


}



keyForm.addEventListener("submit", (e) => {

    // Do not do the browser’s normal form submit behavior. Let my JavaScript handle it.
    e.preventDefault();

    //Reads the current text inside the input box and saves it in accessKey.
    const accessKey = accessKeyInput.value.trim();

    // if accesskey is not inserted throws error
    if (!accessKey) {
        errorMessage.textContent = "Enter access key"
        return
    }

    // if socket exists disconnects it
    if (socket) socket.disconnect();
    queueListenerAttached = false;

    // Create a new socket that tries to connect as a receptionist using this key
    socket = createSocket({ role: "receptionist", accessKey })



    //When the backend accepts the socket connection, run this code.
    socket.on("connect", () => {

        isAuthed = true;
        // clears old error text
        errorMessage.textContent = "";
        setFormEnabled(true);

        lockScreen.hidden = true;
        frontDeskApp.hidden = false;

        // Attaches the nextRace:changed listener to this socket.
        // That listener keeps Front Desk updated when the queue changes elsewhere.
        attachQueueListeners();
        loadSessions();

    })

    socket.on("disconnect", () => {
        lockScreen.hidden = false;
        frontDeskApp.hidden = true;

        errorMessage.textContent = "Server disconnected";

        setFormEnabled(false);
    })




    socket.on("connect_error", (err) => {

        console.log("connect_error:", err.message);

        if (isAuthed) {
            lockScreen.hidden = false;
            frontDeskApp.hidden = true;
            setFormEnabled(false);
            if (!errorMessage.textContent) {
                errorMessage.textContent = "Server disconnected";

            }

            return;
        }

        setFormEnabled(true);

        if (err.message === "xhr poll error") {
            errorMessage.textContent = "Cannot connect to server";
            return;
        }

        if (err.message === "Invalid access key") {
            errorMessage.textContent = "Invalid access key";
            return;
        }

        errorMessage.textContent = "Connection failed. Please try again.";
    });


    // connect to the backend using the handshake auth
    socket.connect();

});

function renderSessions(sessions) {
    sessionsContainer.innerHTML = "";


    // newest session first 
    sessions = [...sessions].sort((a, b) => b.id - a.id);

    // Loops through each session in the array and creates a card for each
    sessions.forEach((session) => {
        const card = document.createElement("div");
        card.className = "session-card";

        // computes taken cars
        const takenCars = session.drivers.map((driver) => driver.carNumber);
        card.innerHTML = `
        <h3>Session ${session.id}</h3>
        
      <form class="driver-form">

      <!-- form-label - styling, car-label - positioning -->
  <p class="form-label car-label">Select Car</p>

  <div class="car-picker">

  <!-- creates array with 8 items -->
    ${Array.from({ length: 8 }, (_, i) => {

            // convert index to car number
            const carNumber = i + 1;


            const isTaken = takenCars.includes(carNumber);

            return `
        <button
          class="car-chip ${isTaken ? "taken" : ""}"
          type="button"
          data-car="${carNumber}"
          ${isTaken ? "disabled" : ""}
        >
          Car ${carNumber}
        </button>
      `;
        }).join("")}
         </div>
            <input class="driver-name-input" maxlength="${MAX_DRIVER_NAME_LENGTH}" type="text" placeholder="Enter driver´s name" />
            <input class="car-number-input" type="hidden" value="" />
            <button type="submit">Add Driver</button>
            </form>

        <p class="drivers-error"></p>
        <div class="drivers-container"></div>

        <button class= "rmv-session-btn" type=button>Remove Session</button>
        `;

        // holds Car1-Car8 buttons
        const carPicker = card.querySelector(".car-picker");

        // holds info of selected car. hidden
        const carNumberInput = card.querySelector(".car-number-input");

        carPicker.addEventListener("click", (e) => {

            // e.target is the exact element clicked (could be the button text, the button itself, etc.).
            // .closest(".car-chip") walks up the DOM tree to find the nearest ancestor that has class car-chip.
            const chip = e.target.closest(".car-chip");

            // if the click is not on chip, do nothing
            if (!chip) return;

            if (chip.disabled) return;

            // removes selected
            carPicker.querySelectorAll(".car-chip").forEach((btn) => btn.classList.remove("selected"));

            // adds selected
            chip.classList.add("selected");

            // Stores the chosen car number into the hidden input
            carNumberInput.value = chip.dataset.car;
        })

        //quering elements in current session card
        const driverForm = card.querySelector(".driver-form")
        const driverNameInput = card.querySelector(".driver-name-input")
        const driversError = card.querySelector(".drivers-error")

        // submit drivers to session
        driverForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const driverName = formatDriverName(driverNameInput.value);
            const carNumber = Number(carNumberInput.value);


            if (driverName.length > MAX_DRIVER_NAME_LENGTH) {
                driversError.textContent = `Driver name must be ${MAX_DRIVER_NAME_LENGTH} characters or less`;
                return;
            }


            // if name of the driver is not inserted, throw error
            if (driverName === "") {
                driversError.textContent = "Enter the name of the driver";
                return;
            }

            if (!carNumber) {
                driversError.textContent = "Select a car"
                return;
            }

            driversError.textContent = "";
            console.log("sending driver:add", session.id, driverName, carNumber);

            // sends Socket.IO event, payload inlcudes which session to add, normalized drivername, chosen car
            socket.emit("driver:add", { sessionId: session.id, driverName, carNumber }, (response) => {
                console.log("driver: add response:", response);

                if (!response.success) {
                    driversError.textContent = response.error || "Could not add driver";
                    return;
                }
            });
        });



        const driversContainer = card.querySelector(".drivers-container")

        // loops every driver, builds one row for each
        session.drivers.forEach((driver) => {
            const row = document.createElement("div");
            row.className = "driver-row";
            row.innerHTML = `
            <span class="driver-badge">Car ${driver.carNumber}</span>
            <span class="driver-name">${driver.name}</span>
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
                        driversError.textContent = response.error || "Could not remove driver"
                        return;
                    }
                });
            });

            const editDriverBtn = row.querySelector(".edit-driver-btn")

            editDriverBtn.addEventListener("click", () => {

                row.innerHTML = `
                <span class="driver-badge">Car ${driver.carNumber}</span>
                <input class="edit-driver-input" type="text" maxlength="${MAX_DRIVER_NAME_LENGTH}">
                <button class="save-driver-btn" type="button">Save</button>
                <button class="cancel-driver-btn" type="button">Cancel</button>
                `;

                const editInput = row.querySelector(".edit-driver-input");
                editInput.value = driver.name;

                const saveBtn = row.querySelector(".save-driver-btn");
                const cancelBtn = row.querySelector(".cancel-driver-btn");

                cancelBtn.addEventListener("click", loadSessions);

                saveBtn.addEventListener("click", () => {
                    const newDriverName = editInput.value.trim();

                    if (newDriverName.length > MAX_DRIVER_NAME_LENGTH) {
                        driversError.textContent = `Driver name must be ${MAX_DRIVER_NAME_LENGTH} characters or less`;
                        return;
                    }



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
            })
        })
        sessionsContainer.appendChild(card);
    })
}

// ask the backend for the current list of upcoming sessions, then re-render the UI.
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
    });
})
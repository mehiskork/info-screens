const keyForm = document.getElementById("key-form");
const accessKeyInput = document.getElementById("access-key");
const errorMessage = document.getElementById("error-message");
const lockScreen = document.getElementById("lock-screen");
const frontDeskApp = document.getElementById("front-desk-app");
const addSessionBtn = document.getElementById("add-session-btn");
const sessionsContainer = document.getElementById("sessions-container");



const MOCK_KEY = "1";

keyForm.addEventListener("submit", (e) => {

    // Do not do the browser’s normal form submit behavior. Let my JavaScript handle it.
    e.preventDefault();

    //Reads the current text inside the input box and saves it in accessKey.
    const accessKey = accessKeyInput.value.trim();

    // clears old error text
    errorMessage.textContent = "";

    // checks if accessKey is correct, hides lockScreen and shows frontDeskApp
    if (accessKey === MOCK_KEY) {
        lockScreen.hidden = true;
        frontDeskApp.hidden = false;
    } else {
        errorMessage.textContent = "Invalid access key";
    }


});

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
        <p>No drivers yet</p>

        <!-- adds Remove and driver button to every session-->
        <button class="rmv-session-btn" type="button">Remove Session</button>
        <button class="add-driver-btn" type="button">Add Driver</button>

        `;

    //finds the button inside that one card
    const rmvSessionBtn = sessionCard.querySelector(".rmv-session-btn")

    rmvSessionBtn.addEventListener("click", () => {
        sessionCard.remove();

    })

    const addDriverBtn = sessionCard.querySelector(".add-driver-btn")
    addDriverBtn.addEventListener("click", () => {
        addDriverBtn.textContent = "Hello";

    })



    sessionsContainer.appendChild(sessionCard);

});


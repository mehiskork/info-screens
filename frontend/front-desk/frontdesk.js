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
        <p class="no-drivers-text">No drivers yet</p>

        <form class="driver-input">
         <input class="input2" type="text" placeholder="Enter driver´s name" />
         <button class="add-driver-btn" type="submit">Add Driver</button>
         </form>

        <div class="drivers-container">
        <p class="drivers-error"></p>
        
        </div>

       

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
            const driver = document.createElement("p")
            driver.classList.add("driver");
            driver.textContent = driverName;

            // adds name to array for checking duplicates
            driverArr.push(normalizedName);
            console.log(driverArr);

            driversContainer.appendChild(driver);

            // clears name from the input
            driverNameInput.value = "";

        } else {

            driversError.textContent = "Maximum 8 drivers per session";

        }

    });


    sessionsContainer.appendChild(sessionCard);

});





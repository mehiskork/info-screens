const keyForm = document.getElementById("key-form");
const accessKeyInput = document.getElementById("access-key");
const errorMessage = document.getElementById("error-message");
const lockScreen = document.getElementById("lock-screen");
const frontDeskApp = document.getElementById("front-desk-app");

const MOCK_KEY = "test123"

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
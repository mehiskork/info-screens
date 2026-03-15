const socket = io()

const screen = document.getElementById("screen")

socket.on("state:update", (state) => {

    const mode = state.raceMode

    screen.style.animation = ""

    if (mode === "SAFE") {

        screen.style.background =
            "repeating-linear-gradient(45deg, #008000 0px, #008000 40px, #00cc00 40px, #00cc00 80px)"

        screen.style.color = "white"
        screen.innerText = "SAFE"

        screen.style.animation = "moveFlag 6s linear infinite"
    }

    if (mode === "HAZARD") {

        screen.style.background =
            "repeating-linear-gradient(45deg, yellow 0px, yellow 40px, orange 40px, orange 80px)"

        screen.style.color = "black"
        screen.innerText = "HAZARD"

        screen.style.animation = "flash 1s infinite"
    }

    if (mode === "DANGER") {

        screen.style.background =
            "repeating-linear-gradient(45deg, red 0px, red 40px, darkred 40px, darkred 80px)"

        screen.style.color = "white"
        screen.innerText = "DANGER"

        screen.style.animation = "flash 1s infinite"
    }

    if (mode === "FINISH") {

        screen.style.background =
            "repeating-conic-gradient(black 0% 25%, white 0% 50%) 0 0 / 120px 120px"

        screen.style.color = "red"
        screen.innerText = "FINISH"
        screen.style.fontWeight = "bold"
        screen.style.textShadow = "4px 4px 10px black"
    }

})
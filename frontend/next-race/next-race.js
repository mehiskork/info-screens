const fullScreenBtn = document.getElementById("fullscreen-btn");

fullScreenBtn.addEventListener("click", async () => {
    if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
    }



});
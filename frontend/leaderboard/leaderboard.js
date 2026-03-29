document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); // ühendus serveriga
    // viited HTML elemntidele 
    const emptyState = document.getElementById('empty-state'); // Teade, kui rallit pole
    const leaderboardCard = document.getElementById('leaderboard-card'); // Edetabeli kaart
    const flagStatus = document.getElementById('flag-status'); // Lipu staatus
    const timerDisplay = document.getElementById('timer-display'); // Taimeri kuvamine
    const fullscreenBtn = document.getElementById('fullscreen-btn'); // fullscreen nupp
    const mainScreen = document.querySelector('.screen'); // põhivaade

    // FULLSCREEN funktsioon
    if (fullscreenBtn && mainScreen) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                mainScreen.requestFullscreen().catch(err => { //lülitub täisekraanile
                    console.error("Fullscreen error:", err);
                });
            } else { // väljub täisekraanist
                document.exitFullscreen();
            }
        });
        document.addEventListener('fullscreenchange', () => {
            fullscreenBtn.innerText = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
        });
    }
    // andmete uuendamine
    function updateAll() {
        // 1. edetabeli küsimine 
        socket.emit('getLeaderboard', (response) => {
            if (response.success && response.leaderboard && response.leaderboard.length > 0) {
                renderLeaderboard(response.leaderboard); // kuvab edetabeli
                emptyState.hidden = true;
                leaderboardCard.hidden = false; // näitab edetabelit
            } else {
                emptyState.hidden = false; // kui pole aktiivset sõitu
                leaderboardCard.hidden = true; // peidab edetabeli
            }
        });

        // 2. ralli staatus
        socket.emit('getRaceStatus', (response) => {
            if (response.success && response.race) {
                const race = response.race;
                timerDisplay.innerText = `Timer: ${race.secondsRemaining}s`; // Kuvab allesjäänud aja

                // Lipu tekst (SAFE, RACING, PAUSED)
                const mode = race.mode || 'waiting';
                flagStatus.innerText = `Flag: ${mode.toUpperCase()}`;

                // muudab kasti värvid
                flagStatus.className = 'meta-box ' + mode;
            } else {
                // kui ralli ei toimu hetkel, siis kuvab selle
                timerDisplay.innerText = "Timer: --:--";
                flagStatus.innerText = "Flag: Waiting";
                flagStatus.className = 'meta-box';
            }
        });
    }
    // uuendab iga sekundi järel andmeid
    setInterval(updateAll, 1000);
    updateAll();
});
// edetabeli kuvamine
function renderLeaderboard(data) {
    const tbody = document.getElementById('leaderboard-data');
    if (!tbody) return;

    tbody.innerHTML = '';
    data.forEach((driver, index) => {
        const row = document.createElement('tr');

        // millisekundid sekunditeks
        const bestTimeStr = driver.bestTime
            ? (driver.bestTime / 1000).toFixed(3) + 's'
            : '--:--';
        // ridade lisamine tabelisse
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${driver.carNumber}</td>
            <td>${driver.name}</td>
            <td>${bestTimeStr}</td>
            <td>${driver.lapTimes || 0}</td>
        `;
        tbody.appendChild(row);
    });
}
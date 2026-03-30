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
    // live uuendused
    // setIntervall eemaldatud
    // server annab ise märku

    // edetabeli uuendused serverist
    socket.on('leaderboardUpdate', (data) => {
        if (data && data.length > 0) {
            renderLeaderboard(data); // kuvab edetabeli
            emptyState.hidden = true;
            leaderboardCard.hidden = false; // näitab edetabelit
        } else {
            emptyState.hidden = false; // kui pole aktiivset sõitu
            leaderboardCard.hidden = true; // peidab edetabeli
        }
    });

    // ralli staatuse ja taimeri uuendused
    socket.on('raceStatusUpdate', (race) => {
        if (race) {
            timerDisplay.innerText = `Timer: ${race.secondsRemaining}s`; // Kuvab allesjäänud aja
            const mode = race.mode || 'waiting';
            flagStatus.innerText = `Flag: ${mode.toUpperCase()}`;
            flagStatus.className = 'meta-box ' + mode; // muudab kasti värvid
        } else {
            // kui ralli ei toimu hetkel
            timerDisplay.innerText = "Timer: --:--";
            flagStatus.innerText = "Flag: Waiting";
            flagStatus.className = 'meta-box';
        }
    });

    // Algseisu küsimine lehe laadimisel (et ekraan ei oleks alguses tühi)
    socket.emit('getLeaderboard', (response) => {
        if (response.success && response.leaderboard) {
            renderLeaderboard(response.leaderboard);
        }
    });
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
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
    socket.on('leaderboard:updated', (data) => {
        if (data.leaderboard && data.leaderboard.length > 0) {
            renderLeaderboard(data.leaderboard); // kuvab edetabeli
            emptyState.hidden = true;
            leaderboardCard.hidden = false; // näitab edetabelit
        } else {
            emptyState.hidden = false; // kui pole aktiivset sõitu
            leaderboardCard.hidden = true; // peidab edetabeli
        }
    });

    // ralli staatus ja taimer 
    socket.on('race:status', (race) => {
        if (race && race.active) {
            // minutite ja sekundite arvutused
            const minutes = Math.floor(race.secondsRemaining / 60);
            const seconds = race.secondsRemaining % 60;

            // kui alla kümne, siis tuleb null ette
            const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

            timerDisplay.innerText = `Timer: ${timeString}`; // Kuvab allesjäänud aja
            const mode = race.mode || 'waiting'; // Lipu tekst (SAFE, RACING, PAUSED)
            flagStatus.innerText = `Flag: ${mode.toUpperCase()}`;
            flagStatus.className = 'meta-box ' + mode; // muudab kasti värvid
        } else {
            // kui ralli ei toimu hetkel
            timerDisplay.innerText = "Timer: --:--";
            flagStatus.innerText = "Flag: Waiting";
            flagStatus.className = 'meta-box';
            // näitab viimast lõppenud ralli edetabelit
            // varem kadus edetabel kohe kui ralli lõppes, nüüd jääb nähtavaks
            if (race.lastFinishedRace && race.lastFinishedRace.leaderboard) {
                renderLeaderboard(race.lastFinishedRace.leaderboard);
                emptyState.hidden = true;
                leaderboardCard.hidden = false;
            } else {
                emptyState.hidden = false;
                leaderboardCard.hidden = true;
            }
        }
    });
    // Snapshoti funktsioon lisatud ✅ RT57
    // hoiab ära vananenud taimeri/lipu kuvamise lehe laadimisel
    socket.on('race:statusSnapshot', (data) => {
        if (data.raceStatus) {
            const race = data.raceStatus;
            const minutes = Math.floor(race.secondsRemaining / 60);
            const seconds = race.secondsRemaining % 60;
            const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            timerDisplay.innerText = `Timer: ${timeString}`;
            const mode = race.mode || 'waiting';
            flagStatus.innerText = `Flag: ${mode.toUpperCase()}`;
            flagStatus.className = 'meta-box ' + mode;
        }
        if (data.leaderboard) {
            renderLeaderboard(data.leaderboard.leaderboard);
            emptyState.hidden = true;
            leaderboardCard.hidden = false;
        }
        // näitab viimast lõppenud ralli edetabelit lehe laadimisel ✅ RT57
        // kui ralli pole aktiivne aga lastFinishedRace on olemas, kuvatakse see kohe
        if (!data.raceStatus && !data.leaderboard && data.lastFinishedRace && data.lastFinishedRace.leaderboard) {
            renderLeaderboard(data.lastFinishedRace.leaderboard);
            emptyState.hidden = true;
            leaderboardCard.hidden = false;
        }

    });

    // Algseisu küsimine lehe laadimisel 
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
            <td>${driver.currentLap || 0}</td> 
        `;
        tbody.appendChild(row);
    });
}
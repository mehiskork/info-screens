document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); // ühendus serveriga
    // viited HTML elemntidele 
    const emptyState = document.getElementById('empty-state'); // Teade, kui rallit pole
    const leaderboardCard = document.getElementById('leaderboard-card'); // Edetabeli kaart
    const flagStatus = document.getElementById('flag-status'); // Lipu staatus
    const timerDisplay = document.getElementById('timer-display'); // Taimeri kuvamine
    const fullscreenBtn = document.getElementById('fullscreen-btn'); // fullscreen nupp
    const lapsHeader = document.querySelector('.leaderboard-table thead tr th:last-child'); // RT71: viide viimase veeru pealkirjale
    const sessionTitle = document.getElementById('session-title'); // RT88: viide pealkirjale
    const timerModel = window.createRaceTimerModel({
        showHundredths: false,
        onTick: ({ text }) => {
            timerDisplay.innerText = text;
        }
    });

    // MUUDATUS: sessiooni lõpp flag — hoiab meeles et sessioon on lõppenud
    let sessionEnded = false;
    timerModel.start();

    // FULLSCREEN funktsioon (RT71)
    function updateFullscreenButton() {
        if (document.fullscreenElement) {
            fullscreenBtn.textContent = "Exit Fullscreen";
        } else {
            fullscreenBtn.textContent = "Fullscreen";
        }
    }

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener("click", async () => { // RT71: kogu lehekülg läheb fullscreen'i
            try {
                if (!document.fullscreenElement) {
                    await document.documentElement.requestFullscreen();
                } else {
                    await document.exitFullscreen();
                }
            } catch (err) {
                console.error("Fullscreen error:", err);
            }
        });

        document.addEventListener("fullscreenchange", updateFullscreenButton); // RT71: uuendab nupu teksti
        updateFullscreenButton();
    }
    // live uuendused
    // setIntervall eemaldatud
    // server annab ise märku

    // edetabeli uuendused serverist
    socket.on('leaderboard:updated', (data) => {
        sessionEnded = false; // MUUDATUS: uus ralli algab, lähtesta sessionEnded
        if (lapsHeader) lapsHeader.innerText = 'Current Lap'; // RT71: live ralli — veeru nimi "Current Lap"
        if (sessionTitle) sessionTitle.innerText = 'Live Standings'; // RT88: live ralli pealkiri
        if (data.leaderboard && data.leaderboard.length > 0) {
            renderLeaderboard(data.leaderboard, false); // false = RT71: live režiim
            emptyState.hidden = true;
            leaderboardCard.hidden = false; // näitab edetabelit
        } else {
            emptyState.hidden = false; // kui pole aktiivset sõitu
            leaderboardCard.hidden = true; // peidab edetabeli
        }
    });

    // ralli staatus ja taimer 
    socket.on('race:status', (race) => {
        timerModel.applyState(race);
        if (!sessionEnded) {
            if (race && race.active && race.mode !== 'finish') {
                const mode = race.mode || 'waiting'; // Lipu tekst (SAFE, RACING, PAUSED)
                flagStatus.innerText = mode.toUpperCase();
                flagStatus.className = 'meta-box ' + mode; // muudab kasti värvid
            } else if (race && race.mode === 'finish') {  //  finish režiimil taimer nulli
                timerDisplay.innerText = "00:00";
                flagStatus.innerText = "FINISH";
                flagStatus.className = 'meta-box finish';
            }
        }
        if (!race || !race.active) {
            if (race && race.lastFinishedRace && race.lastFinishedRace.drivers) {
                const leaderboard = buildLeaderboardFromRaw(race.lastFinishedRace);
                if (leaderboard.length > 0) {
                    if (sessionTitle) sessionTitle.innerText = 'Final Standings'; // RT88: lõppenud ralli pealkiri
                    renderLeaderboard(leaderboard, true);
                    emptyState.hidden = true;
                    leaderboardCard.hidden = false;
                } else {
                    emptyState.hidden = false;
                    leaderboardCard.hidden = true;
                }
            } else if (!sessionEnded) {
                emptyState.hidden = false;
                leaderboardCard.hidden = true;
            }
        }
    });

    socket.on('race:modeChanged', (state) => {
        timerModel.applyState(state);

        if (sessionEnded) return;

        const mode = (state && state.mode) ? state.mode.toLowerCase() : '';
        if (!mode) return;

        flagStatus.innerText = mode.toUpperCase();
        flagStatus.className = 'meta-box ' + mode;
    });

    // Snapshoti funktsioon lisatud ✅ RT57
    // hoiab ära vananenud taimeri/lipu kuvamise lehe laadimisel
    socket.on('race:statusSnapshot', (data) => {
        timerModel.applyState(data);
        if (data.raceStatus) {
            const race = data.raceStatus;
            const mode = race.mode || 'waiting';
            flagStatus.innerText = mode.toUpperCase();
            flagStatus.className = 'meta-box ' + mode;
        }
        if (data.leaderboard) {
            if (sessionTitle) sessionTitle.innerText = 'Live Standings'; // RT88: live pealkiri
            renderLeaderboard(data.leaderboard.leaderboard, false); // RT80
            emptyState.hidden = true;
            leaderboardCard.hidden = false;
        }
        // näitab viimast lõppenud ralli edetabelit lehe laadimisel ✅ RT57
        // PARANDUS lastFinishedRace on raw object, ehitame leaderboardi ise
        if (!data.raceStatus && !data.leaderboard && data.lastFinishedRace && data.lastFinishedRace.drivers) {
            const leaderboard = buildLeaderboardFromRaw(data.lastFinishedRace);
            if (leaderboard.length > 0) {
                if (sessionTitle) sessionTitle.innerText = 'Final Standings'; // RT88: lõppenud ralli pealkiri
                renderLeaderboard(leaderboard, true); // RT71: true = sessiooni lõpp režiim
                emptyState.hidden = true;
                leaderboardCard.hidden = false;
            } else {
                emptyState.hidden = false;
                leaderboardCard.hidden = true;
            }
        }
    });

    // sessiooni lõpp, taimer ja lipp lähevad kohe nulli
    // backend saadab race:sessionEnded sündmuse kui sessioon lõpetatakse
    // ilma selleta jäi taimer käima peale End Session nupu vajutamist
    socket.on('race:sessionEnded', () => {
        sessionEnded = true; // MUUDATUS: märgib sessiooni lõppenuks
        if (lapsHeader) lapsHeader.innerText = 'Laps'; // RT71: sessiooni lõpp — veeru nimi "Laps"
        if (sessionTitle) sessionTitle.innerText = 'Final Standings'; // RT88: lõppenud ralli pealkiri
        timerDisplay.innerText = "00:00";
        flagStatus.innerText = "DANGER"; // punane danger lipp peale sessiooni lõppu ✅
        flagStatus.className = 'meta-box danger'; // punane taust ✅
        // RT80 - Backend data kasutamine
        // RT88: eemaldatud broken if (race && race.lastFinishedRace) plokk
        // RT88: lõppenud ralli andmed tulevad race:status / race:statusSnapshot kaudu
    });

    // finish režiim, taimer läheb kohe nulli
    // backend saadab race:finished sündmuse kui ralli lõpeb (käsitsi või taimeri lõppedes)
    socket.on('race:finished', () => {
        timerModel.applyState({ mode: 'finish' });
        timerDisplay.innerText = "00:00";
        flagStatus.innerText = "FINISH";
        flagStatus.className = 'meta-box finish'; // ruuduline must-valge lipp CSS-ist
    });

    // Algseisu küsimine lehe laadimisel 
    socket.emit('getLeaderboard', (response) => {
        if (response.success && response.leaderboard) {
            renderLeaderboard(response.leaderboard);
        }
    });
});

// ✅ PARANDUS RT57: leaderboard raw object build
// lastFinishedRace ei sisalda valmis leaderboardi, vaid raw race objecti
function buildLeaderboardFromRaw(race) {
    if (!race || !race.drivers || !race.laps) return [];

    const leaderboard = race.drivers.map(driver => {
        const lapData = race.laps[driver.carNumber] || {
            bestTime: null,
            currentLap: 0,
            lapTimes: []
        };
        return {
            carNumber: driver.carNumber,
            name: driver.name,
            bestTime: lapData.bestTime,
            currentLap: lapData.currentLap,
            lapTimes: lapData.lapTimes.length
        };
    });

    // sorteerib parima aja järgi
    leaderboard.sort((a, b) => {
        if (a.bestTime === null) return 1;
        if (b.bestTime === null) return -1;
        return a.bestTime - b.bestTime;
    });

    return leaderboard;
}
// edetabeli kuvamine
// RT71: sessionEnded parameeter — true = sessiooni lõpp, false = live režiim
function renderLeaderboard(data, sessionEnded = false) {
    const tbody = document.getElementById('leaderboard-data');
    const lapsHeader = document.querySelector('.leaderboard-table thead tr th:last-child');
    if (!tbody) return;

    if (lapsHeader) {
        lapsHeader.innerText = sessionEnded ? 'Laps' : 'Current Lap';
    }

    tbody.innerHTML = '';

    data.forEach((driver, index) => {
        const row = document.createElement('tr');

        const bestTimeStr = driver.bestTime
            ? (() => {
                const ms = driver.bestTime;
                const minutes = Math.floor(ms / 60000);
                const seconds = Math.floor((ms % 60000) / 1000);
                const milliseconds = ms % 1000;
                return minutes > 0
                    ? `${minutes}:${seconds < 10 ? '0' : ''}${seconds}.${String(milliseconds).padStart(3, '0')}`
                    : `${seconds}.${String(milliseconds).padStart(3, '0')}`;
            })()
            : '00:00';

        const lapsValue = sessionEnded
            ? Math.max(0, (driver.currentLap || 0) - 1)
            : (driver.currentLap || 0);

        const rankCell = document.createElement('td');
        rankCell.textContent = String(index + 1);

        const carCell = document.createElement('td');
        carCell.textContent = String(driver.carNumber);

        const nameCell = document.createElement('td');
        nameCell.textContent = driver.name;

        const bestTimeCell = document.createElement('td');
        bestTimeCell.textContent = bestTimeStr;

        const lapsCell = document.createElement('td');
        lapsCell.textContent = String(lapsValue);

        row.append(rankCell, carCell, nameCell, bestTimeCell, lapsCell);
        tbody.appendChild(row);
    });
}

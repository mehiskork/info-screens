document.addEventListener('DOMContentLoaded', () => {
    // 1. Ühendus serveriga 
    const socket = io();

    // 2. Viited HTML elementidele
    const leaderboardTable = document.getElementById('leaderboard-data');
    const emptyState = document.getElementById('empty-state');
    const leaderboardCard = document.getElementById('leaderboard-card');
    const flagStatus = document.getElementById('flag-status');
    const timerDisplay = document.getElementById('timer-display');
    const fullscreenBtn = document.getElementById('fullscreen-btn');

    //  FULLSCREEN LOOGIKA 
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.error("Fullscreen viga:", err);
                });
                fullscreenBtn.innerText = "Exit Fullscreen";
            } else {
                document.exitFullscreen();
                fullscreenBtn.innerText = "Fullscreen";
            }
        });
    }

    //  ANDMETE UUENDAMISE FUNKTSIOONID 

    function updateAll() {
        //  värske edetabel
        socket.emit('getLeaderboard', (response) => {
            if (response.success && response.leaderboard) {
                renderLeaderboard(response.leaderboard);
                emptyState.hidden = true;
                leaderboardCard.hidden = false;
            } else {
                // Kui ralli pole aktiivne
                emptyState.hidden = false;
                leaderboardCard.hidden = true;
            }
        });

        // ralli staatus (aeg ja lipu värv)
        socket.emit('getRaceStatus', (response) => {
            if (response.success && response.race) {
                const race = response.race;
                timerDisplay.innerText = `Timer: ${race.secondsRemaining}s`;
                flagStatus.innerText = `Flag: ${race.mode.toUpperCase()}`;

                // lipu kasti värvid vastavalt režiimile (CSS klassid: safe, racing, paused)
                flagStatus.className = 'meta-box ' + race.mode;
            } else {
                timerDisplay.innerText = "Timer: --:--";
                flagStatus.innerText = "Flag: Waiting";
                flagStatus.className = 'meta-box';
            }
        });
    }

    // andmete uuendamine (1 sekund)
    setInterval(updateAll, 1000);

    // Esimene laadimine kohe
    updateAll();
});

// Funktsioon andmete tabelisse joonistamiseks
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
document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); // ühendus serveriga
    // viited HTML elemntidele 
    const emptyState = document.getElementById('empty-state');
    const leaderboardCard = document.getElementById('leaderboard-card');
    const flagStatus = document.getElementById('flag-status');
    const timerDisplay = document.getElementById('timer-display');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const mainScreen = document.querySelector('.screen');

    // FULLSCREEN 
    if (fullscreenBtn && mainScreen) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                mainScreen.requestFullscreen().catch(err => {
                    console.error("Fullscreen viga:", err);
                });
            } else {
                document.exitFullscreen();
            }
        });
        document.addEventListener('fullscreenchange', () => {
            fullscreenBtn.innerText = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
        });
    }

    function updateAll() {
        // 1. edetabeli küsimine 
        socket.emit('getLeaderboard', (response) => {
            if (response.success && response.leaderboard && response.leaderboard.length > 0) {
                renderLeaderboard(response.leaderboard);
                emptyState.hidden = true;
                leaderboardCard.hidden = false;
            } else {
                emptyState.hidden = false;
                leaderboardCard.hidden = true;
            }
        });

        // 2. ralli staatus
        socket.emit('getRaceStatus', (response) => {
            if (response.success && response.race) {
                const race = response.race;
                timerDisplay.innerText = `Timer: ${race.secondsRemaining}s`;

                // Lipu tekst (SAFE, RACING, PAUSED)
                const mode = race.mode || 'waiting';
                flagStatus.innerText = `Flag: ${mode.toUpperCase()}`;

                // muudab kasti värvid
                flagStatus.className = 'meta-box ' + mode;
            } else {
                timerDisplay.innerText = "Timer: --:--";
                flagStatus.innerText = "Flag: Waiting";
                flagStatus.className = 'meta-box';
            }
        });
    }

    setInterval(updateAll, 1000);
    updateAll();
});

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
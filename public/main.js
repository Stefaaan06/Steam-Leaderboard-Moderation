let currentPage = 0;
const pageSize = 10;
let currentLeaderboardID = "";
let totalEntriesCount = 0;
let displayType = "";

document.addEventListener('DOMContentLoaded', () => {
    // When "Load Leaderboards" is clicked
    document.getElementById('loadLeaderboardsBtn')
        .addEventListener('click', loadLeaderboards);

    // When "Load Leaderboard Entries" is clicked
    document.getElementById('loadEntriesBtn')
        .addEventListener('click', onLoadEntries);

    // Pagination
    document.getElementById('prevPageBtn')
        .addEventListener('click', onPrevPage);
    document.getElementById('nextPageBtn')
        .addEventListener('click', onNextPage);
});

async function loadLeaderboards() {
    const appid = document.getElementById('appidSelect').value;
    try {
        const response = await fetch(`/leaderboards/getLeaderboards?appid=${appid}`);
        const data = await response.json();
        const leaderboardSelect = document.getElementById('leaderboardSelect');
        leaderboardSelect.innerHTML = '<option value="">-- Select a Leaderboard --</option>';
        data.leaderboards.forEach(lb => {
            const option = document.createElement('option');
            // Store numeric id and displaytype as data attribute
            option.value = lb.id;
            option.setAttribute('data-displaytype', lb.displaytype || "");
            option.text = `${lb.display_name} (ID: ${lb.id})`;
            leaderboardSelect.appendChild(option);
        });
    } catch (err) {
        alert('Error loading leaderboards: ' + err.message);
    }
}

function onLoadEntries() {
    const select = document.getElementById('leaderboardSelect');
    if (!select.value) {
        alert('Please select a leaderboard');
        return;
    }
    currentLeaderboardID = select.value;
    displayType = select.selectedOptions[0].getAttribute('data-displaytype') || "";
    currentPage = 0;
    loadCurrentPage();
}

function onPrevPage() {
    if (currentPage > 0) {
        currentPage--;
        loadCurrentPage();
    }
}

function onNextPage() {
    if ((currentPage + 1) * pageSize < totalEntriesCount) {
        currentPage++;
        loadCurrentPage();
    }
}

async function loadCurrentPage() {
    const appid = document.getElementById('appidSelect').value;
    if (!currentLeaderboardID) return;
    const start = currentPage * pageSize;
    // Adjusted calculation for the end index:
    const end = start + pageSize;
    try {
        let url = `/leaderboards/getLeaderboardEntries?appid=${appid}&leaderboardid=${currentLeaderboardID}&rangestart=${start}&rangeend=${end}&datarequest=RequestGlobal`;
        const response = await fetch(url);
        const data = await response.json();
        const entries = data.entries || [];
        totalEntriesCount = data.totalEntries || 0;

        // Collect steamIDs for player summaries
        const steamIDs = entries.map(e => e.steamid).join(',');
        let playerNameMap = {};
        if (steamIDs) {
            const psResponse = await fetch(`/leaderboards/getPlayerSummaries?steamids=${steamIDs}`);
            const psData = await psResponse.json();
            const players = psData.players || [];
            players.forEach(p => {
                playerNameMap[p.steamid] = p.personaname;
            });
        }
        renderEntriesTable(entries, playerNameMap);

        // Adjust page info display: end is exclusive, so display end as is
        document.getElementById('pageInfo').textContent =
            `Page ${currentPage + 1} (showing entries ${start + 1} - ${end} of ${totalEntriesCount || '?'})`;
    } catch (err) {
        alert('Error loading leaderboard entries: ' + err.message);
    }
}


function renderEntriesTable(entries, playerNameMap) {
    const tbody = document.querySelector('#entriesTable tbody');
    tbody.innerHTML = "";

    entries.forEach(entry => {
        const tr = document.createElement('tr');

        // Rank cell
        const rankTd = document.createElement('td');
        rankTd.textContent = entry.rank;
        tr.appendChild(rankTd);

        // Player cell
        const nameTd = document.createElement('td');
        const personaName = playerNameMap[entry.steamid] || entry.steamid;
        nameTd.textContent = personaName;
        tr.appendChild(nameTd);

        entry.name = personaName;

        // Score cell
        const scoreTd = document.createElement('td');
        scoreTd.textContent = formatScore(entry.score, displayType);
        tr.appendChild(scoreTd);

        // Actions cell
        const actionsTd = document.createElement('td');
        const editBtn = document.createElement('button');
        editBtn.textContent = "Edit";
        editBtn.addEventListener('click', () => handleEditEntry(entry));
        const removeBtn = document.createElement('button');
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener('click', () => handleRemoveEntry(entry));
        actionsTd.appendChild(editBtn);
        actionsTd.appendChild(removeBtn);
        tr.appendChild(actionsTd);

        tbody.appendChild(tr);
    });
}

function formatScore(score, displayType) {
    if (displayType.toLowerCase() === 'milliseconds') {
        return formatMilliseconds(score);
    }
    return score;
}

// Convert milliseconds to mm:ss.xxx
function formatMilliseconds(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}


async function handleEditEntry(entry) {
    const defaultVal = convertMsToObject(entry.score);  //  minutes, seconds, milliseconds

    const minutes = prompt("Enter minutes for user: " + entry.name, defaultVal.minutes);
    if (minutes === null || isNaN(parseInt(minutes))) {
        alert("Please enter a valid number for minutes.");
        return;
    }
    const seconds = prompt("Enter seconds for user:" + entry.name, defaultVal.seconds);
    if (seconds === null || isNaN(parseInt(seconds))) {
        alert("Please enter a valid number for seconds.");
        return;
    }
    const milliseconds = prompt("Enter milliseconds for user: " + entry.name, defaultVal.milliseconds);
    if (milliseconds === null || isNaN(parseInt(milliseconds))) {
        alert("Please enter a valid number for milliseconds.");
        return;
    }

    const newScore = (parseInt(minutes) * 60 + parseInt(seconds)) * 1000 + parseInt(milliseconds);

    if (!confirm(`Update score to ${newScore} (ms)?`)) return;

    const appid = document.getElementById('appidSelect').value;
    const leaderboardid = currentLeaderboardID;

    try {
        const response = await fetch('/moderation/updateEntry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appid, leaderboardid, steamid: entry.steamid, newScore })
        });
        const data = await response.json();
        if (data.success) {
            alert("Entry updated successfully.");
            await loadCurrentPage();
        } else {
            alert("Error updating entry: " + data.error);
        }
    } catch (err) {
        alert("Error updating entry: " + err.message);
    }
}

// Convert existing ms to  minutes, seconds, milliseconds
function convertMsToObject(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;
    return { minutes, seconds, milliseconds };
}

async function handleRemoveEntry(entry) {
    if (!confirm("Are you sure you want to remove this entry for user: " + entry.user)) return;
    const appid = document.getElementById('appidSelect').value;
    const leaderboardid = currentLeaderboardID;
    try {
        const response = await fetch('/moderation/removeEntry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appid, leaderboardid, steamid: entry.steamid })
        });
        const data = await response.json();
        if (data.success) {
            alert("Entry removed successfully.");


            await loadCurrentPage();
        } else {
            alert("Error removing entry: " + data.error);
        }
    } catch (err) {
        alert("Error removing entry: " + err.message);
    }
}

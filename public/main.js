let currentPage = 0;
const pageSize = 10;
let currentLeaderboardID = "";
let totalEntriesCount = 0;
let displayType = "";

let errorCount = 0;

let modalOverlay, modalTitle, modalBody, modalCancelBtn, modalConfirmBtn;

let currentModalAction = null;
let currentModalData = null;

document.addEventListener("DOMContentLoaded", () => {
    modalOverlay = document.getElementById("modalOverlay");
    modalTitle = document.getElementById("modalTitle");
    modalBody = document.getElementById("modalBody");
    modalCancelBtn = document.getElementById("modalCancelBtn");
    modalConfirmBtn = document.getElementById("modalConfirmBtn");

    modalCancelBtn.addEventListener("click", closeModal);
    modalConfirmBtn.addEventListener("click", onModalConfirm);

    document
        .getElementById("loadLeaderboardsBtn")
        .addEventListener("click", onLoadLeaderboardsClick);
    document
        .getElementById("loadEntriesBtn")
        .addEventListener("click", onLoadEntriesClick);
    document
        .getElementById("prevPageBtn")
        .addEventListener("click", onPrevPage);
    document
        .getElementById("nextPageBtn")
        .addEventListener("click", onNextPage);

    const appidSelect = document.getElementById("appidSelect");
    const customInput = document.getElementById("customAppidInput");
    appidSelect.addEventListener("change", () => {
        if (appidSelect.value === "custom") {
            customInput.style.display = "inline-block";
        } else {
            customInput.style.display = "none";
            customInput.value = "";
        }
    });
});

function displayError(message, code = 0) {
    errorCount++;
    const errPanel = document.getElementById("errorMessages");
    errPanel.classList.remove("hidden");
    errPanel.innerHTML += `<p>Error #${errorCount} (Code ${code}): ${message}</p>`;
}

function clearErrors() {
    errorCount = 0;
    const errPanel = document.getElementById("errorMessages");
    errPanel.innerHTML = "";
    errPanel.classList.add("hidden");
}

async function onLoadLeaderboardsClick() {
    clearErrors();
    const appid = getSelectedAppID();
    if (!appid) {
        displayError("Please select or enter an App ID.", 101);
        return;
    }
    await loadLeaderboards(appid);
}

function getSelectedAppID() {
    const selectVal = document.getElementById("appidSelect").value;
    const customVal = document.getElementById("customAppidInput").value.trim();
    return selectVal === "custom" ? customVal : selectVal;
}

async function loadLeaderboards(appid) {
    try {
        const response = await fetch(`/leaderboards/getLeaderboards?appid=${appid}`);
        if (!response.ok) {
            displayError(`Failed loading leaderboards (HTTP ${response.status})`, 102);
            return;
        }
        const data = await response.json();
        if (data.error) {
            displayError(data.error, 103);
            return;
        }
        populateLeaderboardsDropdown(data.leaderboards);
    } catch (err) {
        displayError("Error loading leaderboards: " + err.message, 104);
    }
}

function populateLeaderboardsDropdown(leaderboards) {
    const lbSelect = document.getElementById("leaderboardSelect");
    lbSelect.innerHTML = '<option value="">-- Select a Leaderboard --</option>';
    leaderboards.forEach((lb) => {
        const option = document.createElement("option");
        option.value = lb.id;
        option.setAttribute("data-displaytype", lb.displaytype || "");
        option.textContent = `${lb.display_name} (ID: ${lb.id})`;
        lbSelect.appendChild(option);
    });
}

function onLoadEntriesClick() {
    clearErrors();
    const lbSelect = document.getElementById("leaderboardSelect");
    if (!lbSelect.value) {
        displayError("Please select a leaderboard first.", 201);
        return;
    }
    currentLeaderboardID = lbSelect.value;
    displayType =
        lbSelect.selectedOptions[0].getAttribute("data-displaytype") || "";
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
    clearErrors();
    const appid = getSelectedAppID();
    if (!appid || !currentLeaderboardID) return;

    const start = currentPage * pageSize;
    const end = start + pageSize;

    try {
        let url = `/leaderboards/getLeaderboardEntries?appid=${appid}&leaderboardid=${currentLeaderboardID}&rangestart=${start}&rangeend=${end}&datarequest=RequestGlobal`;
        const response = await fetch(url);
        if (!response.ok) {
            displayError(`Error loading entries (HTTP ${response.status})`, 301);
            return;
        }
        const data = await response.json();
        if (data.error) {
            displayError(data.error, 302);
            return;
        }
        const entries = data.entries || [];
        totalEntriesCount = data.totalEntries || 0;

        // Retrieve player summaries
        const steamIDs = entries.map((e) => e.steamid).join(",");
        let playerNameMap = {};
        if (steamIDs) {
            const psResponse = await fetch(
                `/leaderboards/getPlayerSummaries?steamids=${steamIDs}`
            );
            if (psResponse.ok) {
                const psData = await psResponse.json();
                (psData.players || []).forEach((p) => {
                    playerNameMap[p.steamid] = p.personaname;
                });
            }
        }
        renderEntriesTable(entries, playerNameMap);

        document.getElementById("pageInfo").textContent =
            `Page ${currentPage + 1} (showing entries ${start + 1} - ${end} of ${totalEntriesCount})`;
        document.getElementById("paginationBox").classList.remove("hidden");
    } catch (err) {
        displayError("Error loading leaderboard entries: " + err.message, 303);
    }
}

function renderEntriesTable(entries, playerNameMap) {
    const tbody = document.querySelector("#entriesTable tbody");
    tbody.innerHTML = "";

    entries.forEach((entry) => {
        const tr = document.createElement("tr");
        tr.classList.add("border-b", "hover:bg-gray-50");

        const rankTd = document.createElement("td");
        rankTd.className = "p-2";
        rankTd.textContent = entry.rank;
        tr.appendChild(rankTd);

        const nameTd = document.createElement("td");
        nameTd.className = "p-2";
        const personaName = playerNameMap[entry.steamid] || entry.steamid;
        nameTd.textContent = personaName;
        tr.appendChild(nameTd);

        const scoreTd = document.createElement("td");
        scoreTd.className = "p-2";
        scoreTd.textContent = formatScore(entry.score, displayType);
        tr.appendChild(scoreTd);

        const actionsTd = document.createElement("td");
        actionsTd.className = "p-2";
        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.className =
            "mr-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500";
        editBtn.addEventListener("click", () => openEditModal(entry, personaName));

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.className =
            "px-3 py-1 bg-red-600 text-white rounded hover:bg-red-500";
        removeBtn.addEventListener("click", () =>
            openRemoveModal(entry, personaName)
        );

        actionsTd.appendChild(editBtn);
        actionsTd.appendChild(removeBtn);
        tr.appendChild(actionsTd);

        tbody.appendChild(tr);
    });
}

function formatScore(score, displayType) {
    if (displayType.toLowerCase() === "milliseconds") {
        return formatMilliseconds(score);
    }
    return score;
}

function formatMilliseconds(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(
        milliseconds
    ).padStart(3, "0")}`;
}

function openEditModal(entry, personaName) {
    currentModalAction = "edit";
    currentModalData = { entry, personaName };

    const defaultVal = convertMsToObject(entry.score);

    modalTitle.textContent = "Edit Score for " + personaName;
    modalBody.innerHTML = `
    <div class="mb-3 flex items-center gap-4">
      <label class="flex items-center gap-1">
        <input type="radio" name="scoreType" value="time" checked>
        <span>Time Input</span>
      </label>
      <label class="flex items-center gap-1">
        <input type="radio" name="scoreType" value="number">
        <span>Numeric Input</span>
      </label>
    </div>
    <div id="timeInputs" class="space-y-2">
      <div>
        <label class="block text-sm font-medium">Minutes</label>
        <input type="number" id="editMinutes" class="border border-gray-300 rounded p-1 w-20" value="${defaultVal.minutes}" />
      </div>
      <div>
        <label class="block text-sm font-medium">Seconds</label>
        <input type="number" id="editSeconds" class="border border-gray-300 rounded p-1 w-20" value="${defaultVal.seconds}" />
      </div>
      <div>
        <label class="block text-sm font-medium">Milliseconds</label>
        <input type="number" id="editMs" class="border border-gray-300 rounded p-1 w-24" value="${defaultVal.milliseconds}" />
      </div>
    </div>
    <div id="numberInput" class="space-y-2 hidden">
      <div>
        <label class="block text-sm font-medium">Raw Score</label>
        <input type="number" id="rawNumberScore" class="border border-gray-300 rounded p-1 w-32" placeholder="12345" />
      </div>
    </div>
  `;

    modalBody.querySelectorAll('input[name="scoreType"]').forEach((radio) => {
        radio.addEventListener("change", onScoreTypeChange);
    });

    showModal();
}

function onScoreTypeChange() {
    const timeDiv = modalBody.querySelector("#timeInputs");
    const numberDiv = modalBody.querySelector("#numberInput");
    const selectedVal = modalBody.querySelector('input[name="scoreType"]:checked').value;
    if (selectedVal === "time") {
        timeDiv.classList.remove("hidden");
        numberDiv.classList.add("hidden");
    } else {
        timeDiv.classList.add("hidden");
        numberDiv.classList.remove("hidden");
    }
}

function convertMsToObject(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;
    return { minutes, seconds, milliseconds };
}

function openRemoveModal(entry, personaName) {
    currentModalAction = "remove";
    currentModalData = { entry, personaName };
    modalTitle.textContent = "Remove Score for " + personaName + "?";
    modalBody.innerHTML = `<p class="text-gray-700">Are you sure you want to remove this entry?</p>`;
    showModal();
}

function showModal() {
    modalOverlay.classList.remove("hidden");
    modalOverlay.classList.add("flex");
}
function closeModal() {
    modalOverlay.classList.add("hidden");
    modalOverlay.classList.remove("flex");
    currentModalAction = null;
    currentModalData = null;
    modalBody.innerHTML = "";
}
async function onModalConfirm() {
    if (currentModalAction === "edit") {
        await doEditEntry();
    } else if (currentModalAction === "remove") {
        await doRemoveEntry();
    }
    closeModal();
}

// Edit Entry
async function doEditEntry() {
    clearErrors();
    const { entry } = currentModalData;
    const appid = getSelectedAppID();
    const leaderboardid = currentLeaderboardID;

    const mode = modalBody.querySelector('input[name="scoreType"]:checked').value;
    let newScore = 0;
    if (mode === "time") {
        const minutes = parseInt(document.getElementById("editMinutes").value);
        const seconds = parseInt(document.getElementById("editSeconds").value);
        const milliseconds = parseInt(document.getElementById("editMs").value);
        if ([minutes, seconds, milliseconds].some(isNaN)) {
            displayError("Invalid time input. Must be numbers.", 501);
            return;
        }
        newScore = (minutes * 60 + seconds) * 1000 + milliseconds;
    } else {
        const rawVal = parseInt(document.getElementById("rawNumberScore").value);
        if (isNaN(rawVal)) {
            displayError("Invalid numeric input.", 502);
            return;
        }
        newScore = rawVal;
    }

    try {
        const response = await fetch("/moderation/updateEntry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appid, leaderboardid, steamid: entry.steamid, newScore }),
        });
        const data = await response.json();
        if (data.success) {
            loadCurrentPage();
        } else {
            displayError("Error updating entry: " + data.error, 503);
        }
    } catch (err) {
        displayError("Error updating entry: " + err.message, 504);
    }
}

// Remove Entry
async function doRemoveEntry() {
    clearErrors();
    const { entry } = currentModalData;
    const appid = getSelectedAppID();
    const leaderboardid = currentLeaderboardID;

    try {
        const response = await fetch("/moderation/removeEntry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appid, leaderboardid, steamid: entry.steamid }),
        });
        const data = await response.json();
        if (data.success) {
            loadCurrentPage();
        } else {
            displayError("Error removing entry: " + data.error, 601);
        }
    } catch (err) {
        displayError("Error removing entry: " + err.message, 602);
    }
}


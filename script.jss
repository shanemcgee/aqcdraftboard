// ==========================================
// CONFIGURATION & GLOBAL STATE
// ==========================================
const TOTAL_TEAMS = 10;
const TOTAL_ROUNDS = 15;
const TOTAL_PICKS = TOTAL_TEAMS * TOTAL_ROUNDS;

let draftOrder = [
    "Team 1", "Team 2", "Team 3", "Team 4", "Team 5",
    "Team 6", "Team 7", "Team 8", "Team 9", "Team 10"
];

let draftState = Array(TOTAL_PICKS).fill(null); // Array of 150 picks
let players = []; // Player pool strictly loaded from server CSV
let currentPickIndex = 0;

// Timer State
let timerInterval = null;
let timeLeft = 120; // Default 2:00
let selectedTimerDuration = 120;
let isTimerRunning = false;

// Audio context for beep
let audioCtx = null;

// ==========================================
// DOM ELEMENTS
// ==========================================
const draftBoardEl = document.getElementById("draftBoard");
const setupBanner = document.getElementById("setupBanner");
const csvFileInput = document.getElementById("csvFileInput");
const searchInput = document.getElementById("searchInput");
const searchDropdown = document.getElementById("searchDropdown");
const currentPickIndicator = document.getElementById("currentPickIndicator");
const rosterModal = document.getElementById("rosterModal");
const rosterModalContent = document.getElementById("rosterModalContent");
const closeModalBtn = document.getElementById("closeModalBtn");
const rosterTeamSelect = document.getElementById("rosterTeamSelect");

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    loadServerData();
    initAudio();

    // Listen for cross-tab updates (so viewer.html updates live when index.html makes a pick)
    window.addEventListener("storage", (event) => {
        if (event.key === "aqc_draft_state") {
            const savedState = localStorage.getItem("aqc_draft_state");
            if (savedState) {
                try {
                    draftState = JSON.parse(savedState);
                    currentPickIndex = draftState.findIndex(pick => pick === null);
                    if (currentPickIndex === -1) currentPickIndex = TOTAL_PICKS;
                } catch (e) {
                    console.error("Error parsing saved draft state", e);
                }
            }
            renderBoard();
            updateCurrentPickIndicator();
            populateTeamDropdown();
        }
    });
});

function initAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
        audioCtx = new AudioContext();
    }
}

function playBeep(frequency = 440, duration = 0.15) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// ==========================================
// SERVER DATA LOADING (draftorder.csv & players.csv)
// ==========================================
function loadServerData() {
    // 1. Load Draft State (Picks) from localStorage
    const savedState = localStorage.getItem("aqc_draft_state");
    if (savedState) {
        try {
            draftState = JSON.parse(savedState);
            currentPickIndex = draftState.findIndex(pick => pick === null);
            if (currentPickIndex === -1) currentPickIndex = TOTAL_PICKS;
        } catch (e) {
            console.error("Error parsing saved draft state", e);
        }
    }

    // 2. STRICTLY Load draftorder.csv from the server directory
    fetch('draftorder.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error("Could not find draftorder.csv on the server.");
            }
            return response.text();
        })
        .then(csvText => {
            Papa.parse(csvText, {
                header: false,
                skipEmptyLines: true,
                complete: function(results) {
                    // Extract team names from the CSV rows
                    let loadedTeams = [];
                    results.data.forEach(row => {
                        // Takes the first column or handles flat list of team names
                        let val = row[0] || row.Team || row.Name;
                        if (val && val.toString().trim() !== "" && val.toString().toLowerCase() !== "team") {
                            loadedTeams.push(val.toString().trim());
                        }
                    });

                    if (loadedTeams.length > 0) {
                        draftOrder = loadedTeams.slice(0, TOTAL_TEAMS);
                    }
                    
                    // Proceed to load players after team order is secured
                    loadPlayersFromServer();
                }
            });
        })
        .catch(err => {
            console.warn("Could not load draftorder.csv from server. Using default team names.", err);
            loadPlayersFromServer();
        });
}

function loadPlayersFromServer() {
    // 3. STRICTLY Load players.csv from the server directory
    fetch('players.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error("Could not find players.csv on the server.");
            }
            return response.text();
        })
        .then(csvText => {
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    players = results.data;
                    if (setupBanner) setupBanner.style.display = "none";
                    if (searchInput) {
                        searchInput.disabled = false;
                        searchInput.placeholder = `Type player name (${players.length} players loaded)...`;
                    }
                    finalizeInitialization();
                }
            });
        })
        .catch(err => {
            console.error("Server fetch failed for players.csv.", err);
            alert("Could not load players.csv from the server directory. Please ensure players.csv is uploaded to the same folder.");
            finalizeInitialization();
        });
}

function finalizeInitialization() {
    initializeBoard();
    updateCurrentPickIndicator();
    populateTeamDropdown();
    setupEventListeners();
}

function saveDraftState() {
    localStorage.setItem("aqc_draft_state", JSON.stringify(draftState));
}

// ==========================================
// BOARD RENDERING
// ==========================================
function initializeBoard() {
    renderBoard();
}

function renderBoard() {
    if (!draftBoardEl) return;
    draftBoardEl.innerHTML = "";

    // 1. Create Header Row (Sticky)
    const headerRow = document.createElement("tr");
    headerRow.className = "sticky top-0 z-20 bg-slate-900 text-white shadow-md";
    
    // Round Column Header
    const roundTh = document.createElement("th");
    roundTh.className = "p-3 border border-slate-700 text-center font-bold text-xs uppercase tracking-wider bg-slate-900 sticky left-0 z-30";
    roundTh.innerText = "Round";
    headerRow.appendChild(roundTh);

    // Team Column Headers
    for (let t = 0; t < TOTAL_TEAMS; t++) {
        const teamTh = document.createElement("th");
        teamTh.className = "p-3 border border-slate-700 text-center font-semibold text-sm truncate max-w-[130px]";
        teamTh.innerText = `${t + 1}. ${draftOrder[t] || 'Team ' + (t + 1)}`;
        headerRow.appendChild(teamTh);
    }
    draftBoardEl.appendChild(headerRow);

    // 2. Create Round Rows (1 to 15)
    for (let r = 0; r < TOTAL_ROUNDS; r++) {
        const row = document.createElement("tr");
        row.className = "bg-slate-900/50";

        // Round Number Cell (Sticky left)
        const roundTd = document.createElement("td");
        roundTd.className = "p-2 border border-slate-700 text-center font-bold text-xs bg-slate-900 text-slate-400 sticky left-0 z-10";
        roundTd.innerText = r + 1;
        row.appendChild(roundTd);

        // 10 Pick Cells per Round (Serpentine / Snake logic)
        for (let c = 0; c < TOTAL_TEAMS; c++) {
            // Even rounds (0, 2, 4...) go 1->10. Odd rounds (1, 3, 5...) go 10->1.
            const teamIndex = (r % 2 === 0) ? c : (TOTAL_TEAMS - 1 - c);
            const pickIndex = (r * TOTAL_TEAMS) + c;
            const pickData = draftState[pickIndex];

            const cellTd = document.createElement("td");
            cellTd.className = "border border-slate-700 p-2 h-16 align-top relative transition-all duration-150";
            cellTd.dataset.pickIndex = pickIndex;

            // Highlight current pick cell
            if (pickIndex === currentPickIndex) {
                cellTd.classList.add("ring-2", "ring-sky-400", "bg-sky-950/30");
            }

            if (pickData) {
                // Cell filled with player
                const posClass = getPositionColorClass(pickData.Pos);
                cellTd.className += ` ${posClass} text-white shadow-inner`;
                
                cellTd.innerHTML = `
                    <div class="flex flex-col justify-between h-full text-xs">
                        <div>
                            <div class="font-bold truncate">${escapeHtml(pickData.Player)}</div>
                            <div class="text-[10px] opacity-90">${escapeHtml(pickData.Pos)} - ${escapeHtml(pickData.Team || '')} (Bye: ${escapeHtml(pickData.Bye || '-')})</div>
                        </div>
                        <div class="text-right font-mono text-[9px] opacity-75">#${pickIndex + 1}</div>
                    </div>
                `;
            } else {
                // Empty cell
                cellTd.innerHTML = `
                    <div class="flex justify-between items-start h-full text-[10px] text-slate-500 font-mono">
                        <span>${r + 1}.${c + 1}</span>
                        <span>#${pickIndex + 1}</span>
                    </div>
                `;
            }

            row.appendChild(cellTd);
        }

        draftBoardEl.appendChild(row);
    }
}

function getPositionColorClass(pos) {
    if (!pos) return "bg-slate-800";
    const p = pos.toUpperCase();
    if (p.includes("QB")) return "bg-amber-700 hover:bg-amber-600";
    if (p.includes("RB")) return "bg-emerald-700 hover:bg-emerald-600";
    if (p.includes("WR")) return "bg-yellow-700 hover:bg-yellow-600";
    if (p.includes("TE")) return "bg-purple-700 hover:bg-purple-600";
    if (p.includes("K")) return "bg-pink-700 hover:bg-pink-600";
    if (p.includes("DST") || p.includes("DEF")) return "bg-rose-800 hover:bg-rose-700";
    return "bg-slate-800";
}

// ==========================================
// SEARCH & DRAFT EXECUTION
// ==========================================
function setupEventListeners() {
    // CSV Upload handler (Temporary local override for player pool testing only)
    if (csvFileInput) {
        csvFileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    players = results.data;
                    if (setupBanner) setupBanner.style.display = "none";
                    if (searchInput) {
                        searchInput.disabled = false;
                        searchInput.placeholder = `Type player name (${players.length} players loaded)...`;
                    }
                    renderBoard();
                    alert(`Loaded ${players.length} players for this session.`);
                }
            });
        });
    }

    // Search input typing
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.trim().toLowerCase();
            if (query.length < 2) {
                searchDropdown.classList.add("hidden");
                searchDropdown.innerHTML = "";
                return;
            }

            // Filter out already drafted players
            const draftedNames = new Set(draftState.filter(p => p !== null).map(p => p.Player.toLowerCase()));
            
            const matches = players.filter(p => {
                const name = (p.Player || p.Name || "").toLowerCase();
                return name.includes(query) && !draftedNames.has(name);
            }).slice(0, 10); // Limit to top 10 matches

            displaySearchDropdown(matches);
        });
    }

    // Close dropdown on outside click
    document.addEventListener("click", (e) => {
        if (!e.target.closest("#searchInput") && !e.target.closest("#searchDropdown")) {
            if (searchDropdown) searchDropdown.classList.add("hidden");
        }
    });

    // Roster Modal bindings
    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", () => rosterModal.classList.add("hidden"));
    }
    if (rosterTeamSelect) {
        rosterTeamSelect.addEventListener("change", (e) => renderTeamRosterModal(parseInt(e.target.value)));
    }
}

function displaySearchDropdown(matches) {
    if (!searchDropdown) return;
    searchDropdown.innerHTML = "";

    if (matches.length === 0) {
        searchDropdown.innerHTML = `<div class="p-2 text-slate-400 text-sm">No available players found.</div>`;
        searchDropdown.classList.remove("hidden");
        return;
    }

    matches.forEach(player => {
        const playerName = player.Player || player.Name || "Unknown Player";
        const playerPos = player.Pos || player.Position || "FA";
        const playerTeam = player.Team || "";
        const playerBye = player.Bye || "-";

        const div = document.createElement("div");
        div.className = "p-2 hover:bg-slate-800 cursor-pointer flex justify-between items-center border-b border-slate-700/50 text-sm";
        div.innerHTML = `
            <div>
                <span class="font-bold text-white">${escapeHtml(playerName)}</span>
                <span class="text-xs text-slate-400 ml-2">${escapeHtml(playerPos)} - ${escapeHtml(playerTeam)}</span>
            </div>
            <div class="text-xs text-slate-500 font-mono">Bye: ${escapeHtml(playerBye)}</div>
        `;
        div.addEventListener("click", () => {
            draftPlayer(player);
            searchInput.value = "";
            searchDropdown.classList.add("hidden");
        });
        searchDropdown.appendChild(div);
    });

    searchDropdown.classList.remove("hidden");
}

function draftPlayer(player) {
    if (currentPickIndex >= TOTAL_PICKS) {
        alert("Draft is already complete!");
        return;
    }

    const playerName = player.Player || player.Name;
    draftState[currentPickIndex] = {
        Player: playerName,
        Pos: player.Pos || player.Position || "FA",
        Team: player.Team || "",
        Bye: player.Bye || "-"
    };

    currentPickIndex++;
    saveDraftState();
    renderBoard();
    updateCurrentPickIndicator();
    resetTimer();
}

function updateCurrentPickIndicator() {
    if (!currentPickIndicator) return;
    if (currentPickIndex >= TOTAL_PICKS) {
        currentPickIndicator.innerText = "Draft Complete!";
        return;
    }

    const round = Math.floor(currentPickIndex / TOTAL_TEAMS) + 1;
    const pickInRound = (currentPickIndex % TOTAL_TEAMS) + 1;
    const teamIndex = (round % 2 !== 0) ? (pickInRound - 1) : (TOTAL_TEAMS - pickInRound);
    const teamName = draftOrder[teamIndex];

    currentPickIndicator.innerHTML = `On the Clock: <span class="text-sky-400 font-bold">${escapeHtml(teamName)}</span> (Round ${round}, Pick ${pickInRound} [Overall #${currentPickIndex + 1}])`;
}

// ==========================================
// COMMISSIONER CONTROLS & UTILITIES
// ==========================================
function revertLastPick() {
    if (currentPickIndex <= 0) {
        alert("No picks to revert.");
        return;
    }
    currentPickIndex--;
    draftState[currentPickIndex] = null;
    saveDraftState();
    renderBoard();
    updateCurrentPickIndicator();
}

function resetToPick1() {
    if (confirm("Are you sure you want to clear all drafted picks and restart from Pick 1?")) {
        draftState = Array(TOTAL_PICKS).fill(null);
        currentPickIndex = 0;
        saveDraftState();
        renderBoard();
        updateCurrentPickIndicator();
    }
}

function resetPlayersPool() {
    if (confirm("Are you sure you want to completely clear the draft state? (Team names and players are strictly tied to server CSV files)")) {
        localStorage.removeItem("aqc_draft_state");
        draftState = Array(TOTAL_PICKS).fill(null);
        currentPickIndex = 0;
        renderBoard();
        updateCurrentPickIndicator();
        alert("Draft state cleared.");
    }
}

function saveBoardCSV() {
    let csv = "Overall,Round,PickInRound,Team,Player,Position,NFLTeam,Bye\n";
    for (let i = 0; i < TOTAL_PICKS; i++) {
        const p = draftState[i];
        const round = Math.floor(i / TOTAL_TEAMS) + 1;
        const pickInRound = (i % TOTAL_TEAMS) + 1;
        const teamIndex = (round % 2 !== 0) ? (pickInRound - 1) : (TOTAL_TEAMS - pickInRound);
        const teamName = draftOrder[teamIndex];

        if (p) {
            csv += `${i + 1},${round},${pickInRound},"${teamName}","${p.Player}","${p.Pos}","${p.Team || ''}","${p.Bye || ''}"\n`;
        } else {
            csv += `${i + 1},${round},${pickInRound},"${teamName}",,,,\n`;
        }
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `draft_board_pick_${currentPickIndex}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// AUTO-DRAFT ENGINE
// ==========================================
function triggerAutoDraft() {
    if (players.length === 0) {
        alert("Please load player data before running auto-draft!");
        return;
    }

    if (currentPickIndex >= TOTAL_PICKS) {
        alert("Draft is already complete!");
        return;
    }

    if (!confirm("Are you sure you want to auto-complete the remaining draft picks?")) {
        return;
    }

    // Simple realistic positional constraints auto-draft
    while (currentPickIndex < TOTAL_PICKS) {
        const draftedNames = new Set(draftState.filter(p => p !== null).map(p => p.Player.toLowerCase()));
        
        // Find best available player from list
        const bestPlayer = players.find(p => {
            const name = (p.Player || p.Name || "").toLowerCase();
            return !draftedNames.has(name);
        });

        if (!bestPlayer) break; // No players left

        draftState[currentPickIndex] = {
            Player: bestPlayer.Player || bestPlayer.Name,
            Pos: bestPlayer.Pos || bestPlayer.Position || "FA",
            Team: bestPlayer.Team || "",
            Bye: bestPlayer.Bye || "-"
        };
        currentPickIndex++;
    }

    saveDraftState();
    renderBoard();
    updateCurrentPickIndicator();
    alert("Auto-draft complete!");
}

// ==========================================
// ROSTER INSPECTOR MODAL
// ==========================================
function openRosterModal() {
    if (!rosterModal) return;
    populateTeamDropdown();
    renderTeamRosterModal(0);
    rosterModal.classList.remove("hidden");
}

function populateTeamDropdown() {
    if (!rosterTeamSelect) return;
    rosterTeamSelect.innerHTML = "";
    draftOrder.forEach((teamName, idx) => {
        const opt = document.createElement("option");
        opt.value = idx;
        opt.innerText = `${idx + 1}. ${teamName}`;
        rosterTeamSelect.appendChild(opt);
    });
}

function renderTeamRosterModal(teamIndex) {
    if (!rosterModalContent) return;
    rosterModalContent.innerHTML = "";

    const teamName = draftOrder[teamIndex];
    let rosterHtml = `<h3 class="text-lg font-bold text-sky-400 mb-4">Roster: ${escapeHtml(teamName)}</h3>`;
    rosterHtml += `<div class="space-y-2 max-h-[60vh] overflow-y-auto pr-2">`;

    // Find all picks belonging to this team
    let teamPicksCount = 0;
    for (let r = 0; r < TOTAL_ROUNDS; r++) {
        const pickInRoundIndex = (r % 2 === 0) ? teamIndex : (TOTAL_TEAMS - 1 - teamIndex);
        const overallPickIndex = (r * TOTAL_TEAMS) + pickInRoundIndex;
        const pickData = draftState[overallPickIndex];

        teamPicksCount++;
        rosterHtml += `
            <div class="flex justify-between items-center bg-slate-800 p-2 rounded border border-slate-700 text-sm">
                <div>
                    <span class="text-xs text-slate-400 font-mono mr-2">R${r + 1} (Pick #${overallPickIndex + 1})</span>
                    <span class="font-semibold text-white">${pickData ? escapeHtml(pickData.Player) : '<span class="text-slate-500 italic">Empty</span>'}</span>
                </div>
                <div>
                    ${pickData ? `<span class="px-2 py-0.5 rounded text-xs font-bold ${getPositionBadgeColor(pickData.Pos)}">${escapeHtml(pickData.Pos)}</span>` : ''}
                </div>
            </div>
        `;
    }

    rosterHtml += `</div>`;
    rosterModalContent.innerHTML = rosterHtml;
}

function getPositionBadgeColor(pos) {
    const p = (pos || "").toUpperCase();
    if (p.includes("QB")) return "bg-amber-900 text-amber-200";
    if (p.includes("RB")) return "bg-emerald-900 text-emerald-200";
    if (p.includes("WR")) return "bg-yellow-900 text-yellow-200";
    if (p.includes("TE")) return "bg-purple-900 text-purple-200";
    if (p.includes("K")) return "bg-pink-900 text-pink-200";
    if (p.includes("DST") || p.includes("DEF")) return "bg-rose-900 text-rose-200";
    return "bg-slate-700 text-slate-300";
}

// ==========================================
// TIMER WIDGET
// ==========================================
function setTimerDuration(seconds) {
    selectedTimerDuration = seconds;
    timeLeft = seconds;
    updateTimerDisplay();
}

function toggleTimer() {
    if (isTimerRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    if (isTimerRunning) return;
    isTimerRunning = true;
    const btn = document.getElementById("timerToggleBtn");
    if (btn) {
        btn.innerText = "Pause Timer";
        btn.className = "px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs";
    }

    timerInterval = setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            if (timeLeft <= 10 && timeLeft > 0) {
                playBeep(600, 0.1); // Tick beep
            }
            if (timeLeft === 0) {
                playBeep(880, 0.4); // End beep
            }
            updateTimerDisplay();
        } else {
            pauseTimer();
        }
    }, 1000);
}

function pauseTimer() {
    isTimerRunning = false;
    clearInterval(timerInterval);
    const btn = document.getElementById("timerToggleBtn");
    if (btn) {
        btn.innerText = "Start Timer";
        btn.className = "px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs";
    }
}

function resetTimer() {
    pauseTimer();
    timeLeft = selectedTimerDuration;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const timerDisplayEl = document.getElementById("timerDisplay");
    if (!timerDisplayEl) return;

    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    timerDisplayEl.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    if (timeLeft <= 10) {
        timerDisplayEl.classList.add("text-rose-500", "animate-pulse");
    } else {
        timerDisplayEl.classList.remove("text-rose-500", "animate-pulse");
    }
}

// ==========================================
// HELPER UTILITIES
// ==========================================
function escapeHtml(str) {
    if (!str) return "";
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

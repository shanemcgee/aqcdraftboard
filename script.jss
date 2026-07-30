let players = [];
let currentDraftIndex = 0; 
const totalTeams = 10;
const totalRounds = 15;
const totalCells = totalTeams * totalRounds;

// Generate the 10x15 Grid on Page Load
function initializeBoard() {
    const headerRow = document.getElementById("headerRow");
    const boardBody = document.getElementById("boardBody");

    if (!headerRow || !boardBody) {
        console.error("Draft board HTML table elements missing!");
        return;
    }

    // Create headers for Teams 1 to 10
    for (let t = 1; t <= totalTeams; t++) {
        const th = document.createElement("th");
        th.textContent = `Team ${t}`;
        headerRow.appendChild(th);
    }

    // Create 15 rows for the rounds
    for (let r = 1; r <= totalRounds; r++) {
        const tr = document.createElement("tr");
        for (let t = 1; t <= totalTeams; t++) {
            const td = document.createElement("td");
            td.setAttribute("data-index", ((r - 1) * totalTeams) + (t - 1));
            td.textContent = "";
            tr.appendChild(td);
        }
        boardBody.appendChild(tr);
    }
    console.log("10x15 Draft board grid built successfully.");
}

// Fetch and parse the CSV file
fetch('RotoBaller PPR Cheet Football Fantasy Draft Cheat Sheet.csv')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
    })
    .then(csvText => {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                players = results.data;
                console.log("Loaded players count:", players.length);
            }
        });
    })
    .catch(error => {
        console.error('Error fetching CSV file. Make sure your local server is running from the project root folder:', error);
    });

const searchInput = document.getElementById("playerSearch");
const resultsContainer = document.getElementById("searchResults");

searchInput.addEventListener("input", function() {
    const input = this.value.trim().toLowerCase();
    resultsContainer.innerHTML = "";
    
    if (input.length > 0) {
        // Filter players matching input string
        const matches = players.filter(player => {
            return player.Player && player.Player.toLowerCase().includes(input);
        });
        
        matches.forEach(match => {
            const div = document.createElement("div");
            div.textContent = `${match.Player} - ${match.Position} (${match.Team}) [Bye: ${match.Bye}]`;
            
            // When selecting a player from the dropdown
            div.addEventListener("click", () => {
                if (currentDraftIndex >= totalCells) {
                    alert("Draft board is full!");
                    return;
                }

                // Find target cell on grid
                const targetCell = document.querySelector(`td[data-index='${currentDraftIndex}']`);
                if (targetCell) {
                    targetCell.textContent = `${match.Player} (${match.Position})`;
                    
                    // Apply position color class safely
                    const cellClass = `${match.Position.trim()}-cell`;
                    targetCell.classList.add(cellClass);
                    
                    currentDraftIndex++;
                }

                resultsContainer.style.display = "none";
                searchInput.value = "";
            });
            
            resultsContainer.appendChild(div);
        });
        
        resultsContainer.style.display = matches.length > 0 ? "block" : "none";
    } else {
        resultsContainer.style.display = "none";
    }
});

// Hide dropdown when clicking outside
document.addEventListener("click", function(e) {
    if (!e.target.closest('.search-container')) {
        resultsContainer.style.display = "none";
    }
});

// Initialize grid when window loads
window.onload = initializeBoard;
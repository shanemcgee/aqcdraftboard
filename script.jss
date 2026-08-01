// 3. Load Co-located players.csv automatically from the server
fetch('players.csv')
    .then(response => {
        if (!response.ok) {
            throw new Error("Could not find players.csv in the directory.");
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
                renderBoard();
            }
        });
    })
.catch(err => {
    // Falls back to local storage only if the server file isn't found
    console.warn("Automatic players.csv fetch failed. Falling back to localStorage cache.", err);
    // ...
});

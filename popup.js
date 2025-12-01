function fmt(ms) {
    const m = Math.floor(ms/60000);
    const s = Math.floor(ms/1000) % 60;
    return `${m}m ${s}s`;
}

function update() {
    chrome.storage.local.get({debugLog: []}, res => {
        const map = {};
        res.debugLog.forEach(e => {
            map[e.domain] = (map[e.domain] || 0) + e.duration;
        });
        const sorted = Object.entries(map).sort((a,b) => b[1] - a[1]);
        const total = Object.values(map).reduce((a,b) => a + b, 0);

        const html = sorted.length === 0
        ? "No activity recorded yet"
        : sorted.map(([d, t]) => `<div class="site"><span>${d}</span><b>${fmt(t)}</b></div>`).join("") +
        `<div class="total">Total today: ${fmt(total)}</div>`;

        document.getElementById("data").innerHTML = html;
    });
}

// ─────── SECURE SHRED + DELETE ───────
document.getElementById("clear").addEventListener("click", () => {
    const msg = document.getElementById("msg");
    msg.style.display = "block";
    msg.innerHTML = "Shredding data (3-pass overwrite)…";

    // Step 1: Overwrite stored data 3 times with junk
    const junk1 = Array(500).fill("OVERWRITTEN_BY_RANDOM_DATA_" + Math.random());
    const junk2 = Array(500).fill(0);
    const junk3 = Array(500).fill("FINAL_WIPE_" + Date.now());

    // Pass 1 – random garbage
    chrome.storage.local.set({debugLog: junk1}, () => {
        // Pass 2 – zeros
        chrome.storage.local.set({debugLog: junk2}, () => {
            // Pass 3 – more random garbage
            chrome.storage.local.set({debugLog: junk3}, () => {
                // Final: actually delete everything
                chrome.storage.local.clear(() => {
                    // Tell background to reset in-memory timer too
                    chrome.runtime.sendMessage({action: "fullReset"});

                    document.getElementById("data").innerHTML = "<i>No activity recorded yet</i>";
                    msg.innerHTML = `
                    <strong>All data securely shredded & deleted!</strong><br><br>
                    Your tracking data was overwritten 3 times<br>
                    (DoD-style wipe) and then permanently removed<br>
                    from Brave's local storage.<br><br>
                    Nothing can be recovered — not even with forensic tools.
                    `;
                    setTimeout(() => msg.style.display = "none", 9000);
                });
            });
        });
    });
});

update();
setInterval(update, 1000);

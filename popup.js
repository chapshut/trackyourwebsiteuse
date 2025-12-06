// popup.js — FINAL WITH CSV + JSON EXPORT

// === THEME SYSTEM ===
const body = document.body;
const toggle = document.getElementById("themeToggle");

chrome.storage.sync.get({ theme: "dark" }, (res) => {
    body.setAttribute("data-theme", res.theme);
});

toggle.addEventListener("click", () => {
    const current = body.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    body.setAttribute("data-theme", next);
    chrome.storage.sync.set({ theme: next });
});

// === TIME FORMATTING ===
function fmt(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor(ms / 1000) % 60;
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// === MAIN UPDATE FUNCTION ===
function update() {
    chrome.storage.local.get({ debugLog: [] }, res => {
        const log = res.debugLog || [];
        const today = new Date().toISOString().slice(0, 10);
        const byDate = {};

        log.forEach(e => {
            const date = e.date || today;
            if (!byDate[date]) byDate[date] = {};
            byDate[date][e.domain] = (byDate[date][e.domain] || 0) + e.duration;
        });

        // Today
        const todayData = byDate[today] || {};
        const todayHtml = Object.entries(todayData)
        .sort((a, b) => b[1] - a[1])
        .map(([d, t]) => `<div class="row"><div class="domain" title="${d}">${d}</div><div class="time">${fmt(t)}</div></div>`)
        .join("") || `<i style="opacity:0.6">No activity today</i>`;

        document.getElementById("today").innerHTML = todayHtml;
        document.getElementById("todayTotal").textContent = `Today total: ${fmt(Object.values(todayData).reduce((a, b) => a + b, 0))}`;

        // Daily average
        const daily = {};
        Object.values(byDate).forEach(sites => {
            Object.entries(sites).forEach(([domain, time]) => {
                daily[domain] = (daily[domain] || 0) + time;
            });
        });
        const daysCount = Object.keys(byDate).length || 1;
        const dailyHtml = Object.entries(daily)
        .sort((a, b) => b[1] - a[1])
        .map(([d, t]) => `<div class="row"><div class="domain" title="${d}">${d}</div><div class="time">${fmt(t)} <span class="avg">avg ${fmt(t / daysCount)}/day</span></div></div>`)
        .join("") || `<i style="opacity:0.6">No data yet</i>`;

        document.getElementById("dailyAvg").innerHTML = dailyHtml;

        // Weekly
        const last7Dates = Object.keys(byDate).sort().slice(-7);
        const weekly = {};
        last7Dates.forEach(date => {
            const day = byDate[date] || {};
            Object.entries(day).forEach(([d, t]) => weekly[d] = (weekly[d] || 0) + t);
        });
        const weeklyHtml = Object.entries(weekly)
        .sort((a, b) => b[1] - a[1])
        .map(([d, t]) => `<div class="row"><div class="domain" title="${d}">${d}</div><div class="time">${fmt(t)} <span class="weekly">avg ${fmt(t / last7Dates.length)}/day</span></div></div>`)
        .join("") || `<i style="opacity:0.6">No recent activity</i>`;

        document.getElementById("weeklyAvg").innerHTML = weeklyHtml;
    });
}

// === EXPORT FUNCTIONS ===
function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

document.getElementById("exportCsv").onclick = () => {
    chrome.storage.local.get({ debugLog: [] }, res => {
        const log = res.debugLog || [];
        if (log.length === 0) {
            alert("No data to export!");
            return;
        }

        const csv = [
            "Date,Domain,Duration (ms),Duration (formatted)",
                             ...log.map(e => `${e.date},${e.domain},${e.duration},${fmt(e.duration)}`)
        ].join("\n");

        downloadText(`time-tracker-export-${new Date().toISOString().slice(0,10)}.csv`, csv);
        document.getElementById("msg").textContent = "CSV exported!";
        document.getElementById("msg").style.display = "block";
        setTimeout(() => document.getElementById("msg").style.display = "none", 3000);
    });
};

document.getElementById("exportJson").onclick = () => {
    chrome.storage.local.get({ debugLog: [] }, res => {
        const log = res.debugLog || [];
        if (log.length === 0) {
            alert("No data to export!");
            return;
        }

        const json = JSON.stringify(log, null, 2);
        downloadText(`time-tracker-export-${new Date().toISOString().slice(0,10)}.json`, json);
        document.getElementById("msg").textContent = "JSON exported!";
        document.getElementById("msg").style.display = "block";
        setTimeout(() => document.getElementById("msg").style.display = "none", 3000);
    });
};

// === CLEAR & REFRESH ===
document.getElementById("clear").onclick = () => {
    if (confirm("Delete ALL tracking data permanently?")) {
        chrome.storage.local.clear(() => {
            chrome.runtime.sendMessage({ action: "fullReset" });
            update();
            const msg = document.getElementById("msg");
            msg.textContent = "All data wiped!";
            msg.style.display = "block";
            setTimeout(() => msg.style.display = "none", 3000);
        });
    }
};

update();
setInterval(update, 1500);

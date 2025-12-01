function fmt(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor(ms / 1000) % 60;
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function update() {
    chrome.storage.local.get({debugLog: []}, res => {
        const log = res.debugLog || [];
        const today = new Date().toISOString().slice(0,10);
        const byDate = {};
        log.forEach(e => {
            const date = e.date || today;
            if (!byDate[date]) byDate[date] = {};
            byDate[date][e.domain] = (byDate[date][e.domain] || 0) + e.duration;
        });

        // Today
        const todayData = byDate[today] || {};
        const todayHtml = Object.entries(todayData)
        .sort((a,b) => b[1] - a[1])
        .map(([d, t]) => `<div class="row"><div class="domain" title="${d}">${d}</div><div class="time">${fmt(t)}</div></div>`)
        .join("") || "<i style='color:#888'>No activity today</i>";

        document.getElementById("today").innerHTML = todayHtml;
        document.getElementById("todayTotal").textContent = `Today total: ${fmt(Object.values(todayData).reduce((a,b)=>a+b,0))}`;

        // Daily average
        const daily = {};
        Object.entries(byDate).forEach(([_, sites]) => {
            Object.entries(sites).forEach(([d, t]) => daily[d] = (daily[d] || 0) + t);
        });
        const daysCount = Object.keys(byDate).length;
        const dailyHtml = Object.entries(daily)
        .sort((a,b) => b[1] - a[1])
        .map(([d, t]) => `<div class="row"><div class="domain" title="${d}">${d}</div><div class="time">${fmt(t)} <span class="avg">avg ${fmt(t/daysCount)}/day</span></div></div>`)
        .join("") || "<i style='color:#888'>No data yet</i>";

        document.getElementById("dailyAvg").innerHTML = dailyHtml;

        // Weekly
        const last7 = Object.keys(byDate).sort().slice(-7);
        const weekly = {};
        last7.forEach(date => {
            const day = byDate[date] || {};
            Object.entries(day).forEach(([d, t]) => weekly[d] = (weekly[d] || 0) + t);
        });
        const weeklyHtml = Object.entries(weekly)
        .sort((a,b) => b[1] - a[1])
        .map(([d, t]) => `<div class="row"><div class="domain" title="${d}">${d}</div><div class="time">${fmt(t)} <span class="weekly">avg ${fmt(t/last7.length)}/day</span></div></div>`)
        .join("") || "<i style='color:#888'>No recent activity</i>";

        document.getElementById("weeklyAvg").innerHTML = weeklyHtml;
    });
}

document.getElementById("clear").onclick = () => {
    if (confirm("Delete all tracking data?")) {
        chrome.storage.local.clear(() => {
            chrome.runtime.sendMessage({action: "fullReset"});
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

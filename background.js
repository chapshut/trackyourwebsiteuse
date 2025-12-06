// background.js — FINAL PRODUCTION VERSION
let current = {
    url: null,
    domain: null,
    startTime: 0
};

let heartbeatActive = false;

function startHeartbeat() {
    if (heartbeatActive) return;
    heartbeatActive = true;

    const tick = async () => {
        if (!heartbeatActive) return;

        if (current.domain && current.startTime) {
            const duration = Date.now() - current.startTime;
            if (duration >= 2000) {
                await saveLiveDuration(duration);
            }
        }
        setTimeout(tick, 5000);
    };
    tick();
}

async function saveLiveDuration(duration) {
    const date = new Date().toISOString().slice(0, 10);
    const domain = current.domain;

    const { debugLog = [] } = await chrome.storage.local.get({ debugLog: [] });
    const lastIdx = debugLog.length - 1;

    if (lastIdx >= 0 && debugLog[lastIdx].domain === domain && !debugLog[lastIdx].final) {
        debugLog[lastIdx].duration = duration;
    } else {
        debugLog.push({ domain, duration, date, final: false });
    }
    await chrome.storage.local.set({ debugLog });
}

async function loadSession() {
    const data = await chrome.storage.session.get(["current"]);
    if (data.current?.domain && data.current.startTime > 0) {
        current = data.current;
        startHeartbeat();
    }
}

async function saveSession() {
    if (current.domain && current.startTime) {
        await chrome.storage.session.set({ current });
    }
}

async function endCurrentSession() {
    if (!current.domain || !current.startTime) return;

    const duration = Date.now() - current.startTime;
    if (duration >= 2000) {
        const date = new Date().toISOString().slice(0, 10);
        const domain = current.domain;

        const { debugLog = [] } = await chrome.storage.local.get({ debugLog: [] });
        const lastIdx = debugLog.length - 1;

        if (lastIdx >= 0 && debugLog[lastIdx].domain === domain && !debugLog[lastIdx].final) {
            debugLog[lastIdx] = { domain, duration, date, final: true };
        } else {
            debugLog.push({ domain, duration, date, final: true });
        }
        await chrome.storage.local.set({ debugLog });
    }

    current = { url: null, domain: null, startTime: 0 };
    await chrome.storage.session.remove(["current"]);
    heartbeatActive = false;
}

// PERFECT DOMAIN LOGIC — MAX 1 SUBDOMAIN DEEP
function getDomain(url) {
    if (!url?.startsWith("http")) return null;
    try {
        const hostname = new URL(url).hostname;

        // Keep platform-style domains intact (myapp.vercel.app)
        const platforms = ['github.io', 'vercel.app', 'netlify.app', 'pages.dev', 'surge.sh', 'glitch.me', 'repl.co'];
        for (const p of platforms) {
            if (hostname.endsWith('.' + p)) {
                const parts = hostname.split('.');
                return parts.slice(-3).join('.');
            }
        }

        const parts = hostname.split('.');

        // localhost, IP, or simple domains
        if (hostname === "localhost" || parts.length <= 2 || parts[0] === "127") {
            return hostname;
        }

        // More than 3 parts → drop deepest subdomains (account.mail.google.com → mail.google.com)
        if (parts.length > 3) {
            return parts.slice(-3).join('.');
        }

        return hostname; // 3 parts = 1 subdomain → allowed (mail.google.com)
    } catch (e) {
        return null;
    }
}

async function switchTo(url) {
    await endCurrentSession();
    const domain = getDomain(url);
    if (!domain) return;

    current = { url, domain, startTime: Date.now() };
    await saveSession();
    startHeartbeat();
}

async function updateActiveTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab?.url) { await endCurrentSession(); return; }

        const domain = getDomain(tab.url);
        if (domain && domain !== current.domain) {
            await switchTo(tab.url);
        } else if (!domain && current.domain) {
            await endCurrentSession();
        }
    } catch (e) { console.error(e); }
}

// Listeners
chrome.tabs.onActivated.addListener(updateActiveTab);
chrome.tabs.onUpdated.addListener((id, change, tab) => {
    if (tab.active && change.url) switchTo(change.url);
});

chrome.windows.onFocusChanged.addListener(winId => {
    if (winId !== chrome.windows.WINDOW_ID_NONE) setTimeout(updateActiveTab, 300);
});

chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener(state => {
    if (state === "idle" || state === "locked") endCurrentSession();
    else if (state === "active") setTimeout(updateActiveTab, 2000);
});

chrome.runtime.onSuspend.addListener(() => { endCurrentSession(); heartbeatActive = false; });

chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
    if (msg.action === "fullReset") {
        endCurrentSession();
        sendResponse({ ok: true });
    }
});

// Start
loadSession();
updateActiveTab();

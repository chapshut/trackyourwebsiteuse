let currentUrl = "";
let startTime = Date.now();

// === 1. Listen for full reset from popup ===
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "fullReset") {
        currentUrl = "";
        startTime = Date.now();

        // Restart tracking the tab you're currently on — from 0 seconds
        chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
            const tab = tabs[0];
            if (tab?.url?.startsWith("http")) {
                currentUrl = tab.url;
                startTime = Date.now();
            }
        });

        sendResponse({status: "reset done"});
    }
});

// === 2. Live update every 5 seconds (so popup shows increasing time) ===
const liveUpdate = setInterval(() => {
    if (!currentUrl) return;
    const durationSoFar = Date.now() - startTime;
    if (durationSoFar < 2000) return; // ignore tiny sessions

    chrome.storage.local.get({debugLog: []}, data => {
        const entries = data.debugLog;
        const last = entries[entries.length - 1];

        if (last && last.domain === new URL(currentUrl).hostname && !last.final) {
            last.duration = durationSoFar; // update existing live entry
        } else {
            entries.push({
                domain: new URL(currentUrl).hostname,
                         duration: durationSoFar,
                         final: false
            });
        }
        chrome.storage.local.set({debugLog: entries});
    });
}, 5000);

// === 3. Save final time when leaving tab or going idle ===
function endSession() {
    if (!currentUrl) return;
    const duration = Date.now() - startTime;
    if (duration < 2000) return;

    chrome.storage.local.get({debugLog: []}, data => {
        const entries = data.debugLog;
        const last = entries[entries.length - 1];

        if (last && last.domain === new URL(currentUrl).hostname && !last.final) {
            last.duration = duration;
            last.final = true;
        } else {
            entries.push({
                domain: new URL(currentUrl).hostname,
                         duration: duration,
                         final: true
            });
        }
        chrome.storage.local.set({debugLog: entries});
    });
}

function startSession(url) {
    if (!url?.startsWith("http")) return;
    endSession();
    currentUrl = url;
    startTime = Date.now();
}

// === 4. Start tracking the tab you're on RIGHT NOW ===
chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
    const tab = tabs[0];
    if (tab?.url?.startsWith("http")) {
        startSession(tab.url);
    }
});

// === 5. Keep tracking new tab switches and URL changes ===
chrome.tabs.onActivated.addListener(info => {
    chrome.tabs.get(info.tabId, tab => {
        if (tab.url?.startsWith("http")) startSession(tab.url);
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.url?.startsWith("http")) {
        startSession(changeInfo.url);
    }
});

// === 6. Stop counting when computer is idle or locked ===
chrome.idle.setDetectionInterval(120);
chrome.idle.onStateChanged.addListener(state => {
    if (state !== "active") endSession();
});

// === 7. Final save when extension unloads ===
chrome.runtime.onSuspend.addListener(() => {
    endSession();
    clearInterval(liveUpdate);
});

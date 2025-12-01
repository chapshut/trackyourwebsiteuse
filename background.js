let currentUrl = "";
let startTime = Date.now();

chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
    if (msg.action === "fullReset") {
        currentUrl = "";
        startTime = Date.now();
        chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
            if (tabs[0]?.url?.startsWith("http")) {
                currentUrl = tabs[0].url;
                startTime = Date.now();
            }
        });
        sendResponse({ok: true});
    }
});

const liveUpdate = setInterval(() => {
    if (!currentUrl) return;
    const dur = Date.now() - startTime;
    if (dur < 2000) return;

    chrome.storage.local.get({debugLog: []}, data => {
        const log = data.debugLog;
        const last = log[log.length - 1];
        if (last && last.domain === new URL(currentUrl).hostname && !last.final) {
            last.duration = dur;
        } else {
            log.push({
                domain: new URL(currentUrl).hostname,
                     duration: dur,
                     date: new Date().toISOString().slice(0,10),
                     final: false
            });
        }
        chrome.storage.local.set({debugLog: log});
    });
}, 5000);

function endSession() {
    if (!currentUrl) return;
    const dur = Date.now() - startTime;
    if (dur < 2000) return;
    chrome.storage.local.get({debugLog: []}, data => {
        const log = data.debugLog;
        const last = log[log.length - 1];
        if (last && last.domain === new URL(currentUrl).hostname && !last.final) {
            last.duration = dur; last.final = true;
        } else {
            log.push({domain: new URL(currentUrl).hostname, duration: dur, date: new Date().toISOString().slice(0,10), final: true});
        }
        chrome.storage.local.set({debugLog: log});
    });
}

function startSession(url) {
    if (!url?.startsWith("http")) return;
    endSession();
    currentUrl = url;
    startTime = Date.now();
}

chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
    if (tabs[0]?.url?.startsWith("http")) startSession(tabs[0].url);
});

chrome.tabs.onActivated.addListener(info => {
    chrome.tabs.get(info.tabId, tab => {
        if (tab.url?.startsWith("http")) startSession(tab.url);
    });
});

chrome.tabs.onUpdated.addListener((id, change, tab) => {
    if (tab.active && change.url?.startsWith("http")) startSession(change.url);
});

chrome.idle.setDetectionInterval(120);
chrome.idle.onStateChanged.addListener(state => state !== "active" && endSession());
chrome.runtime.onSuspend.addListener(() => { endSession(); clearInterval(liveUpdate); });

// polyfill - Chrome's API is not Promise-based
if (typeof chrome != 'undefined') {
    browser = {
        history: {
            // TODO no possible failure given by callback?
            search: q => {
                return new Promise((ok, ko) => {
                    chrome.history.search(q, h => ok(h));
                })
            },
            getVisits: url => {
                return new Promise((ok, ko) => {
                    chrome.history.getVisits(url, v => ok(v));
                });
            }
        },
        i18n: chrome.i18n
    };
}

// global object for unified logging
webnav = {
    log: (msg) => console.log(`[${new Date().toISOString()}] ${msg}`)
};
// see also polyfill for Chrome in util.js
if (typeof chrome != 'undefined') browser = chrome;

browser.browserAction.onClicked.addListener(() => {
    browser.tabs.create({
        active: true,
        url: '/ui.html'
    });
});
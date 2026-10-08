// Runs in the extension's isolated world. It can read chrome.storage but
// cannot touch the page's JS objects, so it passes the settings to inject.js
// through DOM events, and keeps the last "what was really applied" report
// for the popup.
(() => {
  'use strict';

  const DEFAULTS = {
    enabled: true,
    echoCancellation: 'site',
    noiseSuppression: 'site',
    autoGainControl: 'site',
  };
  const EVT_SETTINGS = 'mic-constraints:settings';
  const EVT_REQUEST = 'mic-constraints:request';
  const EVT_REPORT = 'mic-constraints:report';

  let current = null;
  let lastReport = null;

  function push() {
    if (!current) return;
    document.dispatchEvent(new CustomEvent(EVT_SETTINGS, { detail: JSON.stringify(current) }));
  }

  chrome.storage.local.get(DEFAULTS).then((stored) => {
    current = stored;
    push();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !current) return;
    for (const [key, change] of Object.entries(changes)) current[key] = change.newValue;
    push();
  });

  document.addEventListener(EVT_REQUEST, push);

  document.addEventListener(EVT_REPORT, (event) => {
    try {
      lastReport = JSON.parse(event.detail);
    } catch {
      // Ignore malformed reports.
    }
  });

  // The popup asks every frame of the tab. Only a frame that opened a mic answers.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === 'get-report' && lastReport) sendResponse(lastReport);
  });
})();

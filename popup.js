'use strict';

// Keep in sync with DEFAULTS in bridge.js.
const DEFAULTS = {
  enabled: true,
  echoCancellation: 'site',
  noiseSuppression: 'site',
  autoGainControl: 'site',
};

const LABELS = {
  autoGainControl: 'Auto gain control',
  noiseSuppression: 'Noise suppression',
  echoCancellation: 'Echo cancellation',
};

const enabledInput = document.getElementById('enabled');
const flagsElement = document.getElementById('flags');
const reportElement = document.getElementById('report');

function render(settings) {
  enabledInput.checked = settings.enabled;
  flagsElement.classList.toggle('disabled', !settings.enabled);
  for (const flag of Object.keys(LABELS)) {
    const input = document.querySelector(`input[name="${flag}"][value="${settings[flag]}"]`);
    if (input) input.checked = true;
  }
}

function describe(value) {
  if (value === true) return 'on';
  if (value === false) return 'off';
  return 'not reported';
}

async function showReport() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const report = await chrome.tabs.sendMessage(tab.id, { type: 'get-report' });
    if (!report) return;
    const lines = Object.keys(LABELS).map((flag) => `${LABELS[flag]}: ${describe(report[flag])}`);
    if (report.label) lines.unshift(report.label);
    reportElement.textContent = lines.join('\n');
  } catch {
    // No content script in this tab (chrome:// page, or the tab predates the install).
  }
}

enabledInput.addEventListener('change', async () => {
  await chrome.storage.local.set({ enabled: enabledInput.checked });
  flagsElement.classList.toggle('disabled', !enabledInput.checked);
});

flagsElement.addEventListener('change', (event) => {
  const { name, value } = event.target;
  if (name in LABELS) chrome.storage.local.set({ [name]: value });
});

chrome.storage.local.get(DEFAULTS).then(render);
showReport();

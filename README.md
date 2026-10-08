# Mic Constraints

A small browser extension that forces the microphone processing flags
on or off for every site: auto gain control, noise suppression and
echo cancellation.

Sites choose these flags themselves when they open your microphone.
This extension lets you decide instead.

## Install

1. Clone or download this repository.
2. Open `chrome://extensions` (or `brave://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select this folder.

## Use

Open the popup. Each flag has three states:

- **Site**: the page decides (default)
- **On**: always enabled
- **Off**: always disabled

A change applies the next time a page opens the microphone, so reload
the page. The popup shows what the browser really applied in the
current tab.

## How it works

- `inject.js` runs in the page's JavaScript world at `document_start`.
  It wraps `MediaDevices.getUserMedia` and
  `MediaStreamTrack.applyConstraints`.
- `bridge.js` runs in the extension's isolated world. It reads the
  settings from `chrome.storage.local` and passes them to `inject.js`
  through DOM events.

No data leaves the browser. The only permission is `storage`.

## Limits

- It controls the browser's built-in processing only. A site that runs
  its own audio processing on top is not affected.
- With auto gain control off, your level can be lower.

## Tested on

Chromium with a fake microphone, and Brave on Linux with Google Meet.
Other browsers and sites are untested.

## License

MIT

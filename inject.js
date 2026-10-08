// Runs in the page's own JS world (world: MAIN), before any site script.
// It wraps the two APIs a site can use to choose audio processing:
//   - MediaDevices.getUserMedia        (when the mic is opened)
//   - MediaStreamTrack.applyConstraints (when the site changes it later)
// The settings live in extension storage, which this world cannot read,
// so bridge.js sends them here through DOM events.
(() => {
  'use strict';

  const FLAGS = ['echoCancellation', 'noiseSuppression', 'autoGainControl'];
  const EVT_SETTINGS = 'mic-constraints:settings';
  const EVT_REQUEST = 'mic-constraints:request';
  const EVT_REPORT = 'mic-constraints:report';
  const SETTINGS_TIMEOUT_MS = 300;

  let settings = null;
  let markReady;
  const ready = new Promise((resolve) => { markReady = resolve; });

  document.addEventListener(EVT_SETTINGS, (event) => {
    try {
      settings = JSON.parse(event.detail);
    } catch {
      return;
    }
    markReady();
  });

  // Ask the bridge in case it loaded before this listener existed.
  document.dispatchEvent(new CustomEvent(EVT_REQUEST));

  // Storage is async, so the very first getUserMedia call may arrive before
  // the settings do. Wait for them, but never hold the page for long.
  function waitForSettings() {
    if (settings) return Promise.resolve();
    const timeout = new Promise((resolve) => setTimeout(resolve, SETTINGS_TIMEOUT_MS));
    return Promise.race([ready, timeout]);
  }

  // Returns only the flags the user wants to force, e.g. { autoGainControl: false }.
  function forcedFlags() {
    const forced = {};
    if (!settings || !settings.enabled) return forced;
    for (const flag of FLAGS) {
      if (settings[flag] === 'on') forced[flag] = true;
      if (settings[flag] === 'off') forced[flag] = false;
    }
    return forced;
  }

  // `audio` can be `true` or a MediaTrackConstraints object.
  function patchAudio(audio) {
    const forced = forcedFlags();
    const names = Object.keys(forced);
    if (!audio || names.length === 0) return audio;

    const patched = audio === true ? {} : { ...audio };

    // A site can also set these flags inside `advanced`. Remove them there,
    // so they cannot conflict with the forced top-level values.
    if (Array.isArray(patched.advanced)) {
      patched.advanced = patched.advanced.map((set) => {
        const copy = { ...set };
        for (const name of names) delete copy[name];
        return copy;
      });
    }

    return { ...patched, ...forced };
  }

  // Tell the bridge what the browser really applied (constraints are requests).
  function report(track) {
    if (!track || track.kind !== 'audio') return;
    const actual = track.getSettings();
    const detail = { label: track.label };
    for (const flag of FLAGS) detail[flag] = actual[flag];
    document.dispatchEvent(new CustomEvent(EVT_REPORT, { detail: JSON.stringify(detail) }));
  }

  const originalGetUserMedia = MediaDevices.prototype.getUserMedia;
  MediaDevices.prototype.getUserMedia = async function getUserMedia(constraints) {
    await waitForSettings();
    let patched = constraints;
    if (constraints && constraints.audio) {
      patched = { ...constraints, audio: patchAudio(constraints.audio) };
    }
    const stream = await originalGetUserMedia.call(this, patched);
    report(stream.getAudioTracks()[0]);
    return stream;
  };

  const originalApplyConstraints = MediaStreamTrack.prototype.applyConstraints;
  MediaStreamTrack.prototype.applyConstraints = async function applyConstraints(constraints) {
    const patched = this.kind === 'audio' ? patchAudio(constraints || {}) : constraints;
    const result = await originalApplyConstraints.call(this, patched);
    report(this);
    return result;
  };
})();

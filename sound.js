/* Before Landfall interface sound.
 *
 * Every sound is synthesised with the Web Audio API: there are no audio files to
 * download or license. Sounds only ever answer something the visitor did (a click,
 * a key press, a drag). Nothing plays on page load, on scroll or on hover.
 *
 * Design rules (see the sound study):
 * - Quiet. Frequent sounds sit around 0.05–0.1 gain, rare ones around 0.15.
 * - No sirens, wind or storm effects. Warning stages use calm mallet notes that
 *   get lower as danger rises; "Evacuate now" is a falling fourth, not an alarm.
 * - Sound never carries information alone: visible text and aria-live stay the source.
 * - Anything that loads another page stays silent. The new page is feedback enough, and the
 *   browser cuts off sound on the page being left, so a sound there would mean holding the
 *   page change back until it finished.
 * - The iPhone silent switch is respected (audio session "ambient").
 *
 * Usage from script.js:  window.Sound.play("tick", 1.1)
 */
(function () {
  "use strict";

  const STORAGE_KEY = "sound";
  // The per-sound gains below stay small and easy to compare (0.05–0.16). This lifts the whole
  // set so the loudest sound, "Evacuate now", peaks near −11 dBFS: far enough below clipping
  // that no limiter is needed (the tests check this).
  const MASTER_GAIN = 1.3;
  const TICK_SPACING = 0.035; // seconds between slider ticks, so fast drags never buzz

  let enabled = true;
  try {
    enabled = localStorage.getItem(STORAGE_KEY) !== "off";
  } catch (error) {}

  let ctx = null;
  let out = null;
  let noiseBuffer = null;
  let lastTick = -Infinity;

  function context() {
    if (!ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      // Mix with other audio and stay silent when the phone's silent switch is on.
      if (navigator.audioSession) {
        try { navigator.audioSession.type = "ambient"; } catch (error) {}
      }
      try {
        ctx = new AudioContextClass({ latencyHint: "interactive" });
      } catch (error) {
        return null;
      }
      // master gain -> speakers. Deliberately no DynamicsCompressor: the browser's compressor
      // adds its own make-up gain (about +4 dB here) and starts out ducked, so the first sound
      // after each page load came out up to 15 dB quieter than the same sound a moment later.
      out = ctx.createGain();
      out.gain.value = MASTER_GAIN;
      out.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  const jitter = (amount) => 1 + (Math.random() * 2 - 1) * amount;

  function noise(c) {
    if (noiseBuffer) return noiseBuffer;
    const length = Math.floor(c.sampleRate * 0.6);
    noiseBuffer = c.createBuffer(1, length, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  // Fast linear attack (no click), exponential decay. Exponential ramps cannot reach 0, so stop at 0.0001.
  function envelope(c, t, peak, attack, decay) {
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return gain;
  }

  function tone(c, type, freq, t, peak, attack, decay, glideTo) {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + attack + decay * 0.6);
    const gain = envelope(c, t, peak, attack, decay);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + attack + decay + 0.03);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  function burst(c, t, peak, decay, filterType, freq, q, sweepTo, attack) {
    attack = attack || 0.001;
    const source = c.createBufferSource();
    source.buffer = noise(c);
    const filter = c.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.value = q;
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + decay);
    const gain = envelope(c, t, peak, attack, decay);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    source.start(t, Math.random() * 0.2);
    source.stop(t + attack + decay + 0.03);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  // A soft mallet note: sine body, a quiet 4th harmonic that dies sooner, and a tiny noise strike.
  function mallet(freq, peak, decay, delay) {
    const c = context();
    if (!c) return;
    const t = c.currentTime + 0.005 + (delay || 0);
    tone(c, "sine", freq, t, peak, 0.002, decay);
    tone(c, "sine", freq * 4, t, peak * 0.16, 0.001, decay * 0.22);
    burst(c, t, peak * 0.35, 0.006, "bandpass", Math.min(freq * 2.5, 9000), 1.5);
  }

  const SOUNDS = {
    // One detent of a slider or number box. pitch ~0.85–1.2.
    tick(pitch) {
      // Rate-limit on the page clock: the audio clock sits at 0 until the context starts running.
      const now = performance.now() / 1000;
      if (now - lastTick < TICK_SPACING) return;
      const c = context();
      if (!c) return;
      lastTick = now;
      const t = c.currentTime + 0.003;
      const freq = 3600 * (pitch || 1) * jitter(0.02);
      tone(c, "sine", freq, t, 0.07, 0.0005, 0.006);
      burst(c, t, 0.06, 0.002, "bandpass", freq, 14);
    },
    // An option, tab or filter was chosen.
    select(pitch) {
      const c = context();
      if (!c) return;
      const t = c.currentTime + 0.003;
      const j = jitter(0.03) * (pitch || 1);
      tone(c, "sine", 420 * j, t, 0.08, 0.002, 0.08, 840 * j);
    },
    // "down" falls (dark theme, sound off), "up" rises (light theme, sound on), "mid" is one note.
    toggle(direction) {
      if (direction === "mid") { mallet(1568, 0.08, 0.08); return; }
      const notes = direction === "down" ? [1760, 1320] : [1320, 1760];
      mallet(notes[0], 0.08, 0.06);
      mallet(notes[1], 0.08, 0.09, 0.05);
    },
    // Moving forward or opening something.
    push() {
      const c = context();
      if (!c) return;
      burst(c, c.currentTime + 0.003, 0.05, 0.12, "bandpass", 500, 1.2, 2200, 0.03);
      mallet(880 * jitter(0.02), 0.06, 0.15, 0.06);
    },
    // Moving back or closing something.
    pop() {
      const c = context();
      if (!c) return;
      burst(c, c.currentTime + 0.003, 0.05, 0.12, "bandpass", 2200, 1.2, 500, 0.03);
      mallet(660 * jitter(0.02), 0.06, 0.15, 0.06);
    },
    // Warning stage, using the ids in script.js STAGES. Lower and heavier as danger rises.
    stage(id) {
      if (id === "alert") mallet(784, 0.14, 0.5); // G5
      else if (id === "prepare") mallet(587, 0.15, 0.6); // D5
      else if (id === "evacuate") { mallet(440, 0.16, 0.7); mallet(330, 0.16, 0.9, 0.11); } // A4 then E4
    },
    // Wind category 1–5: one pentatonic note each, rising with the category.
    category(number) {
      const scale = [523, 587, 659, 784, 880];
      const index = Math.max(1, Math.min(5, Number(number) || 1)) - 1;
      mallet(scale[index], 0.12, 0.3);
    },
    // Something worked: copied, saved, downloaded.
    success() {
      mallet(1047, 0.12, 0.35);
      mallet(1319, 0.12, 0.5, 0.07);
    },
    // The whole checklist is done. The site's only celebratory sound.
    complete() {
      [523, 659, 784, 1047].forEach((freq, i) => mallet(freq, 0.12, 0.6, i * 0.07));
    },
    // Something needs fixing. A soft low double pulse, never a buzzer.
    nudge() {
      const c = context();
      if (!c) return;
      const t = c.currentTime + 0.003;
      [0, 0.09].forEach((offset) => tone(c, "sine", 196, t + offset, 0.12, 0.004, 0.07, 175));
    },
    add() {
      SOUNDS.select();
      mallet(988, 0.03, 0.12, 0.03);
    },
    remove() {
      const c = context();
      if (!c) return;
      const j = jitter(0.03);
      tone(c, "sine", 760 * j, c.currentTime + 0.003, 0.07, 0.002, 0.08, 380 * j);
    },
    // Clearing a list.
    sweep() {
      const c = context();
      if (!c) return;
      burst(c, c.currentTime + 0.003, 0.06, 0.3, "lowpass", 4000, 0.8, 250, 0.01);
    },
    // A checkbox: rising when ticked, falling when unticked.
    check(on) {
      if (on) mallet(1175 * jitter(0.01), 0.09, 0.18);
      else mallet(880 * jitter(0.01), 0.07, 0.12);
    },
  };

  function play(name, arg) {
    if (!enabled || !SOUNDS[name]) return;
    try { SOUNDS[name](arg); } catch (error) {}
  }

  function setEnabled(on) {
    enabled = Boolean(on);
    try {
      if (enabled) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, "off");
    } catch (error) {}
  }

  // Unlock audio on the first tap, click or key press. Safari only lets audio start inside
  // these events; a slider drag on an iPhone sends "input" events, which do not count.
  const unlockEvents = ["pointerdown", "keydown", "touchend"];
  function unlock() {
    if (!enabled) return; // stay asleep until sound is wanted; the toggle is itself a click
    const c = context();
    if (!c) return;
    // A one-sample silent buffer finishes the unlock on older iOS Safari.
    try {
      const source = c.createBufferSource();
      source.buffer = c.createBuffer(1, 1, 22050);
      source.connect(c.destination);
      source.start(0);
    } catch (error) {}
    unlockEvents.forEach((type) => window.removeEventListener(type, unlock, true));
  }
  unlockEvents.forEach((type) => window.addEventListener(type, unlock, { capture: true, passive: true }));

  // Save battery: stop the audio clock while the tab is hidden.
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });

  // Fold-out sections (<details>) open with "push" and close with "pop".
  document.addEventListener("click", (event) => {
    if (!event.isTrusted) return;
    const summary = event.target.closest && event.target.closest("summary");
    if (!summary || event.target.closest("a")) return;
    const details = summary.parentElement;
    if (!details || details.tagName !== "DETAILS" || summary !== details.querySelector(":scope > summary")) return;
    play(details.open ? "pop" : "push");
  });

  // The sound on/off button beside the theme switch.
  function setUpToggle() {
    const button = document.getElementById("sound-toggle");
    if (!button) return;
    function paint() {
      button.setAttribute("aria-pressed", String(enabled));
      button.title = enabled ? "Sound on" : "Sound off";
    }
    button.addEventListener("click", () => {
      setEnabled(!enabled);
      paint();
      play("toggle", "up"); // only audible when sound was just turned on
    });
    paint();
    button.hidden = false;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setUpToggle);
  else setUpToggle();

  window.Sound = {
    play: play,
    get enabled() { return enabled; },
  };
})();

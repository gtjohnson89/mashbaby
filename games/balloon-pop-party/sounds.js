/**
 * Synthesized balloon-party sounds via Web Audio API.
 */
(function (global) {
  "use strict";

  let ctx = null;
  let master = null;

  function ensureAudio() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    return ctx;
  }

  function resume() {
    ensureAudio();
    if (ctx.state === "suspended") return ctx.resume();
    return Promise.resolve();
  }

  function envGain(peak, attack, sustain, release, t0) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(peak * 0.55, 0.001), t0 + attack + sustain);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + sustain + release);
    return g;
  }

  function noiseBuffer(duration) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const buf = ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function safe(fn) {
    try {
      ensureAudio();
      if (ctx.state === "suspended") ctx.resume();
      fn();
    } catch (_) {
      /* never break gameplay for audio */
    }
  }

  function playKeyPop() {
    safe(() => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(640 + Math.random() * 200, t);
      osc.frequency.exponentialRampToValueAtTime(320, t + 0.06);
      const g = envGain(0.08, 0.004, 0.02, 0.05, t);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.09);
    });
  }

  /** Air whoosh while balloon inflates */
  function playInflate() {
    safe(() => {
      const t = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(0.45);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(400, t);
      bp.frequency.exponentialRampToValueAtTime(1400, t + 0.4);
      bp.Q.value = 0.8;
      const ng = envGain(0.14, 0.04, 0.25, 0.12, t);
      noise.connect(bp);
      bp.connect(ng);
      ng.connect(master);
      noise.start(t);
      noise.stop(t + 0.5);

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(420, t + 0.4);
      const g = envGain(0.1, 0.05, 0.2, 0.12, t);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  /** Soft squeak as balloon drifts */
  function playFloat() {
    safe(() => {
      const t = ctx.currentTime;
      const start = 480 + Math.random() * 120;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(start, t);
      osc.frequency.exponentialRampToValueAtTime(start * 1.35, t + 0.18);
      const g = envGain(0.09, 0.02, 0.08, 0.12, t);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  /** Satisfying cartoon pop + sparkle */
  function playPop() {
    safe(() => {
      const t = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(0.12);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 900;
      const ng = envGain(0.32, 0.002, 0.02, 0.08, t);
      noise.connect(hp);
      hp.connect(ng);
      ng.connect(master);
      noise.start(t);
      noise.stop(t + 0.12);

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.1);
      const g = envGain(0.22, 0.002, 0.02, 0.08, t);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.12);

      [980, 1320, 1760].forEach((freq, i) => {
        const spark = ctx.createOscillator();
        spark.type = "sine";
        const ts = t + 0.03 + i * 0.04;
        spark.frequency.setValueAtTime(freq, ts);
        spark.frequency.exponentialRampToValueAtTime(freq * 1.4, ts + 0.1);
        const sg = envGain(0.08, 0.005, 0.03, 0.08, ts);
        spark.connect(sg);
        sg.connect(master);
        spark.start(ts);
        spark.stop(ts + 0.14);
      });
    });
  }

  global.GameSounds = {
    resume,
    playKeyPop,
    playInflate,
    playFloat,
    playPop,
  };
})(window);

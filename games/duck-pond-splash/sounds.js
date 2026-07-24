/**
 * Synthesized duck-pond sounds via Web Audio API.
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

  /** Water splash when duck lands */
  function playSplash() {
    safe(() => {
      const t = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(0.28);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(600, t);
      bp.frequency.exponentialRampToValueAtTime(220, t + 0.22);
      bp.Q.value = 0.7;
      const ng = envGain(0.28, 0.005, 0.08, 0.16, t);
      noise.connect(bp);
      bp.connect(ng);
      ng.connect(master);
      noise.start(t);
      noise.stop(t + 0.3);

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.18);
      const g = envGain(0.16, 0.008, 0.05, 0.12, t);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }

  /** Cartoon quack */
  function playQuack() {
    safe(() => {
      const base = 280 + Math.random() * 60;
      [0, 0.14].forEach((off, i) => {
        const t = ctx.currentTime + off;
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(base + i * 20, t);
        osc.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.12);
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 900;
        const g = envGain(0.14, 0.01, 0.05, 0.08, t);
        osc.connect(filter);
        filter.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.16);
      });
    });
  }

  /** Soft ripple / swim whoosh */
  function playSwim() {
    safe(() => {
      const t = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(0.2);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 500;
      const ng = envGain(0.08, 0.02, 0.08, 0.08, t);
      noise.connect(lp);
      lp.connect(ng);
      ng.connect(master);
      noise.start(t);
      noise.stop(t + 0.22);
    });
  }

  global.GameSounds = {
    resume,
    playKeyPop,
    playSplash,
    playQuack,
    playSwim,
  };
})(window);

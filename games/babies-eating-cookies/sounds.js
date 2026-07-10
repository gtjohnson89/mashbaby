/**
 * Synthesized kid-game sounds via Web Audio API.
 * No third-party samples — all generated locally so they're reliable offline.
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

  /** Soft plop when dough lands on the pan */
  function playCookieDrop() {
    safe(() => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.12);
      const g = envGain(0.28, 0.01, 0.04, 0.12, t);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.2);

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(0.08);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      const ng = envGain(0.12, 0.005, 0.02, 0.05, t);
      noise.connect(filter);
      filter.connect(ng);
      ng.connect(master);
      noise.start(t);
      noise.stop(t + 0.09);
    });
  }

  /** Classic kitchen timer: ding-ding-ding */
  function playOvenDing() {
    safe(() => {
      const notes = [1320, 1320, 1760];
      notes.forEach((freq, i) => {
        const t = ctx.currentTime + i * 0.22;
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        const partial = ctx.createOscillator();
        partial.type = "triangle";
        partial.frequency.value = freq * 2.01;
        const g = envGain(0.32, 0.005, 0.08, 0.35, t);
        const gp = envGain(0.08, 0.005, 0.05, 0.25, t);
        osc.connect(g);
        partial.connect(gp);
        g.connect(master);
        gp.connect(master);
        osc.start(t);
        osc.stop(t + 0.45);
        partial.start(t);
        partial.stop(t + 0.35);
      });
    });
  }

  /**
   * Cute cartoon munch — soft chew pulses (not gross/realistic biting).
   * Pitched slightly differently each call so a pile of babies still sounds fun.
   */
  function playMunch() {
    safe(() => {
      const base = 280 + Math.random() * 120;
      const chews = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < chews; i++) {
        const t = ctx.currentTime + i * 0.11;
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(base + i * 18, t);
        osc.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.08);
        const g = envGain(0.22, 0.008, 0.03, 0.07, t);
        osc.connect(g);
        g.connect(master);

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer(0.06);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 700 + Math.random() * 400;
        bp.Q.value = 1.2;
        const ng = envGain(0.09, 0.004, 0.02, 0.04, t);
        noise.connect(bp);
        bp.connect(ng);
        ng.connect(master);

        osc.start(t);
        osc.stop(t + 0.12);
        noise.start(t);
        noise.stop(t + 0.07);
      }

      const t2 = ctx.currentTime + chews * 0.11;
      const chirp = ctx.createOscillator();
      chirp.type = "sine";
      chirp.frequency.setValueAtTime(620, t2);
      chirp.frequency.exponentialRampToValueAtTime(880, t2 + 0.08);
      const cg = envGain(0.1, 0.01, 0.04, 0.08, t2);
      chirp.connect(cg);
      cg.connect(master);
      chirp.start(t2);
      chirp.stop(t2 + 0.15);
    });
  }

  /** Soft baby giggle-ish when baby appears */
  function playBabyArrive() {
    safe(() => {
      const start = 520 + Math.random() * 80;
      [0, 0.12, 0.24].forEach((off, i) => {
        const t = ctx.currentTime + off;
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(start + i * 40, t);
        osc.frequency.exponentialRampToValueAtTime(start + i * 40 + 90, t + 0.1);
        const g = envGain(0.12, 0.01, 0.05, 0.1, t);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.18);
      });
    });
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

  /** Soft freezer pop + chilly sparkle when ice cream appears */
  function playIceCreamDrop() {
    safe(() => {
      const t = ctx.currentTime;
      const pop = ctx.createOscillator();
      pop.type = "triangle";
      pop.frequency.setValueAtTime(180, t);
      pop.frequency.exponentialRampToValueAtTime(70, t + 0.1);
      const pg = envGain(0.2, 0.008, 0.03, 0.1, t);
      pop.connect(pg);
      pg.connect(master);
      pop.start(t);
      pop.stop(t + 0.16);

      [880, 1180, 1480].forEach((freq, i) => {
        const spark = ctx.createOscillator();
        spark.type = "sine";
        const ts = t + 0.05 + i * 0.045;
        spark.frequency.setValueAtTime(freq, ts);
        spark.frequency.exponentialRampToValueAtTime(freq * 1.3, ts + 0.08);
        const sg = envGain(0.07, 0.005, 0.03, 0.08, ts);
        spark.connect(sg);
        sg.connect(master);
        spark.start(ts);
        spark.stop(ts + 0.12);
      });
    });
  }

  /** Soft lick / slurp for ice cream (cute, not gross) */
  function playLick() {
    safe(() => {
      const base = 340 + Math.random() * 80;
      for (let i = 0; i < 3; i++) {
        const t = ctx.currentTime + i * 0.14;
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(base - i * 30, t);
        osc.frequency.exponentialRampToValueAtTime(base * 0.45, t + 0.12);
        const g = envGain(0.16, 0.02, 0.05, 0.1, t);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.18);

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer(0.08);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 500;
        const ng = envGain(0.05, 0.01, 0.03, 0.05, t);
        noise.connect(lp);
        lp.connect(ng);
        ng.connect(master);
        noise.start(t);
        noise.stop(t + 0.09);
      }
    });
  }

  global.GameSounds = {
    resume,
    playCookieDrop,
    playOvenDing,
    playMunch,
    playBabyArrive,
    playKeyPop,
    playIceCreamDrop,
    playLick,
  };
})(window);

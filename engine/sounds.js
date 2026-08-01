/**
 * Shared Web Audio synth bank for mash games.
 * Parent peace: mute persistence, calm (quieter + slower mash feedback).
 */
(function (global) {
  "use strict";

  const MUTE_STORAGE_KEY = "mash:muted";
  const GAIN_NORMAL = 0.85;
  const GAIN_CALM = 0.3;
  const FEEDBACK_GAP_MS = 55;
  const FEEDBACK_GAP_CALM_MS = 160;

  let ctx = null;
  let master = null;
  let muted = readStoredMute();
  let calm = false;
  let lastFeedbackAt = 0;

  function readStoredMute() {
    try {
      return localStorage.getItem(MUTE_STORAGE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function persistMute(value) {
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, value ? "1" : "0");
    } catch (_) {
      /* private mode */
    }
  }

  function targetGain() {
    if (muted) return 0;
    return calm ? GAIN_CALM : GAIN_NORMAL;
  }

  function applyMasterGain() {
    if (master) master.gain.value = targetGain();
  }

  function peakScale() {
    return calm ? 0.42 : 1;
  }

  function ensureAudio() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = targetGain();
    master.connect(ctx.destination);
    return ctx;
  }

  function resume() {
    ensureAudio();
    if (ctx.state === "suspended") return ctx.resume();
    return Promise.resolve();
  }

  function setMuted(next) {
    muted = !!next;
    persistMute(muted);
    ensureAudio();
    applyMasterGain();
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function toggleMute() {
    return setMuted(!muted);
  }

  function setCalm(next) {
    calm = !!next;
    ensureAudio();
    applyMasterGain();
    return calm;
  }

  function isCalm() {
    return calm;
  }

  /** Soft thud when spawn is denied but toddler still mashed. */
  function playSoftThud() {
    safe(() => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(180 + Math.random() * 40, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.08);
      const g = envGain(0.12 * peakScale(), 0.004, 0.03, 0.07, t);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  /**
   * Rate-limited mash feedback so palm-slams feel like a burst, not broken audio.
   * Calm mode lengthens the gap so mash storms stay soft.
   * @param {"pop"|"thud"} kind
   */
  function playFeedback(kind) {
    const now = performance.now();
    const gap = calm ? FEEDBACK_GAP_CALM_MS : FEEDBACK_GAP_MS;
    if (now - lastFeedbackAt < gap) return false;
    lastFeedbackAt = now;
    if (kind === "thud") playSoftThud();
    else playKeyPop();
    return true;
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
      const g = envGain(0.08 * peakScale(), 0.004, 0.02, 0.05, t);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.09);
    });
  }

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
    });
  }

  function playOvenDing() {
    safe(() => {
      [1320, 1320, 1760].forEach((freq, i) => {
        const t = ctx.currentTime + i * 0.22;
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        const g = envGain(0.32, 0.005, 0.08, 0.35, t);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.45);
      });
    });
  }

  function playMunch() {
    safe(() => {
      const base = 280 + Math.random() * 120;
      for (let i = 0; i < 3; i++) {
        const t = ctx.currentTime + i * 0.11;
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(base + i * 18, t);
        osc.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.08);
        const g = envGain(0.22, 0.008, 0.03, 0.07, t);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.12);
      }
    });
  }

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
        const sg = envGain(0.07, 0.005, 0.03, 0.08, ts);
        spark.connect(sg);
        sg.connect(master);
        spark.start(ts);
        spark.stop(ts + 0.12);
      });
    });
  }

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
      }
    });
  }

  function playInflate() {
    safe(() => {
      const t = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(0.45);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(400, t);
      bp.frequency.exponentialRampToValueAtTime(1400, t + 0.4);
      const ng = envGain(0.14, 0.04, 0.25, 0.12, t);
      noise.connect(bp);
      bp.connect(ng);
      ng.connect(master);
      noise.start(t);
      noise.stop(t + 0.5);
    });
  }

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
    });
  }

  function playSplash() {
    safe(() => {
      const t = ctx.currentTime;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(0.28);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(600, t);
      bp.frequency.exponentialRampToValueAtTime(220, t + 0.22);
      const ng = envGain(0.28, 0.005, 0.08, 0.16, t);
      noise.connect(bp);
      bp.connect(ng);
      ng.connect(master);
      noise.start(t);
      noise.stop(t + 0.3);
    });
  }

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

  function playRoar() {
    safe(() => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.35);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 400;
      const g = envGain(0.2, 0.04, 0.15, 0.2, t);
      osc.connect(filter);
      filter.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  function playChirp() {
    safe(() => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(1800, t + 0.08);
      const g = envGain(0.1, 0.005, 0.03, 0.06, t);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  function playSqueak() {
    safe(() => {
      [0, 0.06, 0.13].forEach((off) => {
        const t = ctx.currentTime + off;
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1400 + Math.random() * 400, t);
        osc.frequency.exponentialRampToValueAtTime(900, t + 0.05);
        const g = envGain(0.09, 0.003, 0.02, 0.04, t);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.08);
      });
    });
  }

  const PRESETS = {
    keyPop: playKeyPop,
    softThud: playSoftThud,
    cookieDrop: playCookieDrop,
    ovenDing: playOvenDing,
    munch: playMunch,
    babyArrive: playBabyArrive,
    iceCreamDrop: playIceCreamDrop,
    lick: playLick,
    inflate: playInflate,
    float: playFloat,
    pop: playPop,
    splash: playSplash,
    quack: playQuack,
    swim: playSwim,
    roar: playRoar,
    chirp: playChirp,
    squeak: playSqueak,
  };

  function play(name) {
    if (muted && name !== "keyPop" && name !== "softThud") {
      /* still route through master=0 so timing stays consistent */
    }
    const fn = PRESETS[name];
    if (fn) fn();
  }

  global.MashSounds = {
    resume,
    play,
    playFeedback,
    setMuted,
    isMuted,
    toggleMute,
    setCalm,
    isCalm,
    PRESETS,
  };
})(window);

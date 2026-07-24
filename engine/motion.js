/**
 * Shared motion helpers — respect prefers-reduced-motion and parent Calm mode
 * for both CSS-driven classes and Element.animate (WAAPI).
 */
(function (global) {
  "use strict";

  let calm = false;
  let mq = null;

  function mediaReduce() {
    if (!mq) {
      try {
        mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      } catch (_) {
        return false;
      }
    }
    return !!(mq && mq.matches);
  }

  /** OS reduced-motion — snap / shorten WAAPI travel. Calm does not use this. */
  function reduced() {
    return mediaReduce();
  }

  function setCalm(next) {
    calm = !!next;
    try {
      document.documentElement.classList.toggle("mash-calm", calm);
    } catch (_) {
      /* ignore */
    }
    return calm;
  }

  function isCalm() {
    return calm;
  }

  /** Scale a duration for prefers-reduced-motion only. */
  function duration(ms) {
    const n = typeof ms === "number" ? ms : 300;
    if (!mediaReduce()) return n;
    return Math.min(n, 90);
  }

  /**
   * WAAPI animate with reduced-motion scaling (not calm — calm keeps travel readable).
   * Always returns an object with onfinish so callers stay simple.
   */
  function animate(el, keyframes, options) {
    const opts = Object.assign({}, options || {});
    const rawDur = typeof opts.duration === "number" ? opts.duration : 300;
    opts.duration = duration(rawDur);
    if (mediaReduce()) {
      opts.easing = opts.easing || "linear";
    }
    if (el && typeof el.animate === "function") {
      return el.animate(keyframes, opts);
    }
    const stub = {
      onfinish: null,
      finished: Promise.resolve(),
      cancel() {},
      finish() {
        if (typeof stub.onfinish === "function") stub.onfinish();
      },
    };
    setTimeout(() => stub.finish(), 0);
    return stub;
  }

  global.MashMotion = {
    reduced,
    setCalm,
    isCalm,
    duration,
    animate,
  };
})(window);

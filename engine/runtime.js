/**
 * MashRuntime — loads a GameSpec and runs a playable toddler mash game.
 * Trust & abuse-proofing: adult exit hold, guaranteed mash feedback,
 * multitouch coalescing, touch-first start, crash-proof boot.
 * Parent peace: mute (tap on / hold off), calm mode, soft session wind-down.
 * Parent Wish: hold ★ ~2s → catalog tweak or generative creation → applySpec live.
 */
(function (global) {
  "use strict";

  const EXIT_HOLD_MS = 2000;
  const PARENT_HOLD_MS = 700;
  const DRAG_SPAWN_GAP_PX = 48;
  const BURST_WINDOW_MS = 180;
  const DEFAULT_SESSION_MINUTES = 10;
  const GRACE_EXTRA_MS = 3 * 60 * 1000;
  const WIND_DOWN_MS = 10000;
  const IDLE_ATTRACT_MS = 45000;
  const SESSION_STORAGE_KEY = "mash:sessionMinutes";
  const FALLBACK_SPEC_URL = "../specs/babies-eating-cookies.json";

  function pickWeighted(items) {
    const total = items.reduce((s, i) => s + (i.weight || 1), 0);
    let r = Math.random() * total;
    for (const item of items) {
      r -= item.weight || 1;
      if (r <= 0) return item;
    }
    return items[items.length - 1];
  }

  function MashRuntime(options) {
    this.spec = options.spec;
    this.mount = options.mount;
    this.onExit = options.onExit || null;
    this.live = false;
    this.treats = [];
    this.actorCount = 0;
    this.spawnCount = 0;
    this.lastSpawn = 0;
    this.escHoldStart = null;
    this.exitHoldStart = null;
    this.exitHoldRaf = null;
    this.root = null;
    this.stage = null;
    this.spawnZone = null;
    this.ambientKinds = new Set();
    this.customize = null;
    this.wishes = null;
    this.activePointers = new Map();
    this.burstTimestamps = [];
    this._boundKey = this._onKey.bind(this);
    this._boundKeyUp = this._onKeyUp.bind(this);
    this._boundOrient = this._syncOrientationHint.bind(this);
    this._sessionTimerId = null;
    this._windDownTimerId = null;
    this._idleTimerId = null;
    this._windingDown = false;
    this._graceUsed = false;
    this._sessionMinutes = DEFAULT_SESSION_MINUTES;
    this._calm = false;
    this._muteHoldStart = null;
    this._muteHoldRaf = null;
    this._calmHoldStart = null;
    this._calmHoldRaf = null;
    this._lastInteractAt = 0;
    this._idleFired = false;
  }

  MashRuntime.prototype.mountUI = function () {
    const spec = this.spec;
    this.mount.innerHTML = `
      <div id="start-gate" class="gate">
        <div class="gate__card">
          <p class="gate__brand">${escapeHtml(spec.brand || "mashbaby")}</p>
          <h1 class="gate__title">${escapeHtml(spec.title || "Mash Game")}</h1>
          <p class="gate__copy">${escapeHtml(spec.copy || "Mash anywhere!")}</p>
          <button id="start-btn" class="gate__btn" type="button">Tap to Play!</button>
          <p class="gate__hint">Big taps · mash anywhere</p>
          <p class="gate__parent">Parents: hold ★ Wish or Exit ~2s · tap mute · hold to unmute</p>
        </div>
      </div>
      <div id="orient-hint" class="orient-hint" hidden>
        <p class="orient-hint__text">Tilt for a bigger play area</p>
        <button type="button" class="orient-hint__dismiss" id="orient-dismiss">Keep playing</button>
      </div>
      <div id="game-root" class="game" hidden>
        <div id="scene-root" class="scene-root"></div>
        <div class="hud">
          <p class="hud__hint" id="hint">Mash anywhere!</p>
          <div class="hud__parent" id="parent-bar">
            <button id="mute-btn" class="hud__parent-btn" type="button" title="Tap to mute · hold to unmute" aria-label="Mute">🔊</button>
            <button id="calm-btn" class="hud__parent-btn" type="button" title="Tap for calm · hold to turn off" aria-label="Calm">🌙</button>
            <button id="timer-btn" class="hud__parent-btn" type="button" title="Session timer" aria-label="Session timer">⏱</button>
            <button id="reset-btn" class="hud__parent-btn" type="button" title="Clear scene" aria-label="Reset">↺</button>
            <button id="exit-btn" class="hud__exit" type="button" title="Hold 2 seconds to exit" aria-label="Hold to exit">
              <svg class="hud__exit-ring" viewBox="0 0 36 36" aria-hidden="true">
                <circle class="hud__exit-ring-bg" cx="18" cy="18" r="15" />
                <circle class="hud__exit-ring-fg" id="exit-ring" cx="18" cy="18" r="15" />
              </svg>
              <span class="hud__exit-label">Exit</span>
            </button>
          </div>
        </div>
        <div id="rest-overlay" class="rest-overlay" hidden>
          <div class="rest-overlay__glow" aria-hidden="true"></div>
          <div class="rest-overlay__moon" aria-hidden="true">🌙</div>
          <p class="rest-overlay__zzz" aria-hidden="true">💤</p>
          <button type="button" id="rest-grace-btn" class="rest-overlay__grace" hidden title="A little more">＋</button>
        </div>
      </div>`;

    this.gate = this.mount.querySelector("#start-gate");
    this.startBtn = this.mount.querySelector("#start-btn");
    this.gameRoot = this.mount.querySelector("#game-root");
    this.sceneRoot = this.mount.querySelector("#scene-root");
    this.hint = this.mount.querySelector("#hint");
    this.exitBtn = this.mount.querySelector("#exit-btn");
    this.exitRing = this.mount.querySelector("#exit-ring");
    this.muteBtn = this.mount.querySelector("#mute-btn");
    this.calmBtn = this.mount.querySelector("#calm-btn");
    this.timerBtn = this.mount.querySelector("#timer-btn");
    this.resetBtn = this.mount.querySelector("#reset-btn");
    this.restOverlay = this.mount.querySelector("#rest-overlay");
    this.restGraceBtn = this.mount.querySelector("#rest-grace-btn");
    this.orientHint = this.mount.querySelector("#orient-hint");
    this.orientDismiss = this.mount.querySelector("#orient-dismiss");
    this._orientDismissed = false;

    MashScene.applyTheme(this.mount, spec.theme || {});
    this._resolveSessionMinutes();
    this._syncMuteUi(MashSounds.isMuted());
    this._applyCalm(!!(spec.parent && spec.parent.calmDefault), false);

    const start = (e) => {
      if (e) e.preventDefault();
      if (this.live || this._starting) return;
      this._starting = true;
      Promise.resolve(this.start()).finally(() => {
        this._starting = false;
      });
    };
    this.startBtn.addEventListener("click", start);
    // Whole gate card is tappable for tiny hands / imprecise aim
    this.gate.addEventListener("pointerup", (e) => {
      if (e.target.closest("#orient-hint")) return;
      start(e);
    });

    this._bindExitHold();
    this._bindMuteControl();
    this._bindCalmControl();
    this._bindTimerControl();
    this._mountWishes();
    this.resetBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    this.resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.resetScene();
    });

    this.restGraceBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    this.restGraceBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._useGraceExtension();
    });

    this.orientDismiss.addEventListener("click", () => {
      this._orientDismissed = true;
      this.orientHint.hidden = true;
    });

    this.gameRoot.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    this.gameRoot.addEventListener("pointermove", (e) => this._onPointerMove(e));
    this.gameRoot.addEventListener("pointerup", (e) => this._onPointerUp(e));
    this.gameRoot.addEventListener("pointercancel", (e) => this._onPointerUp(e));

    window.addEventListener("keydown", this._boundKey, true);
    window.addEventListener("keyup", this._boundKeyUp, true);
    window.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("orientationchange", this._boundOrient);
    window.addEventListener("resize", this._boundOrient);
    this._syncOrientationHint();
    this._syncTimerUi();
  };

  MashRuntime.prototype._bindExitHold = function () {
    const begin = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.pointerId != null && this.exitBtn.setPointerCapture) {
        try {
          this.exitBtn.setPointerCapture(e.pointerId);
        } catch (_) {
          /* ignore */
        }
      }
      this._startExitHold();
    };
    const end = (e) => {
      e.stopPropagation();
      this._cancelExitHold();
    };
    this.exitBtn.addEventListener("pointerdown", begin);
    this.exitBtn.addEventListener("pointerup", end);
    this.exitBtn.addEventListener("pointercancel", end);
    this.exitBtn.addEventListener("lostpointercapture", () => this._cancelExitHold());
  };

  MashRuntime.prototype._setExitProgress = function (t) {
    const ring = this.exitRing;
    if (!ring) return;
    const circ = 2 * Math.PI * 15;
    const clamped = Math.max(0, Math.min(1, t));
    ring.style.strokeDasharray = String(circ);
    ring.style.strokeDashoffset = String(circ * (1 - clamped));
    this.exitBtn.classList.toggle("is-holding", clamped > 0.02);
    this.exitBtn.classList.toggle("is-ready", clamped >= 1);
  };

  MashRuntime.prototype._startExitHold = function () {
    if (this.exitHoldStart != null) return;
    this.exitHoldStart = performance.now();
    this.exitBtn.classList.add("is-holding");
    const tick = () => {
      if (this.exitHoldStart == null) return;
      const t = (performance.now() - this.exitHoldStart) / EXIT_HOLD_MS;
      this._setExitProgress(t);
      if (t >= 1) {
        this.exitHoldStart = null;
        this.exitHoldRaf = null;
        this._setExitProgress(0);
        this.stop();
        return;
      }
      this.exitHoldRaf = requestAnimationFrame(tick);
    };
    this.exitHoldRaf = requestAnimationFrame(tick);
  };

  MashRuntime.prototype._cancelExitHold = function () {
    this.exitHoldStart = null;
    if (this.exitHoldRaf != null) {
      cancelAnimationFrame(this.exitHoldRaf);
      this.exitHoldRaf = null;
    }
    this._setExitProgress(0);
    this.exitBtn.classList.remove("is-holding", "is-ready");
  };

  /** Tap to mute (easy for parent); hold to unmute (hard for toddler). */
  MashRuntime.prototype._bindMuteControl = function () {
    const btn = this.muteBtn;
    const begin = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.pointerId != null && btn.setPointerCapture) {
        try {
          btn.setPointerCapture(e.pointerId);
        } catch (_) {
          /* ignore */
        }
      }
      if (MashSounds.isMuted()) {
        this._muteHoldStart = performance.now();
        btn.classList.add("is-holding");
        const tick = () => {
          if (this._muteHoldStart == null) return;
          const t = (performance.now() - this._muteHoldStart) / PARENT_HOLD_MS;
          if (t >= 1) {
            this._muteHoldStart = null;
            this._muteHoldRaf = null;
            btn.classList.remove("is-holding");
            this._syncMuteUi(MashSounds.setMuted(false));
            return;
          }
          this._muteHoldRaf = requestAnimationFrame(tick);
        };
        this._muteHoldRaf = requestAnimationFrame(tick);
      } else {
        this._muteHoldStart = null;
        this._syncMuteUi(MashSounds.setMuted(true));
      }
    };
    const end = (e) => {
      e.stopPropagation();
      this._muteHoldStart = null;
      if (this._muteHoldRaf != null) {
        cancelAnimationFrame(this._muteHoldRaf);
        this._muteHoldRaf = null;
      }
      btn.classList.remove("is-holding");
    };
    btn.addEventListener("pointerdown", begin);
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointercancel", end);
    btn.addEventListener("lostpointercapture", end);
  };

  MashRuntime.prototype._syncMuteUi = function (muted) {
    this.muteBtn.textContent = muted ? "🔇" : "🔊";
    this.muteBtn.classList.toggle("is-active", muted);
    this.muteBtn.classList.toggle("is-muted", muted);
    this.muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    this.muteBtn.title = muted ? "Hold to unmute" : "Tap to mute";
  };

  /** Tap to enable calm; hold to turn calm off. */
  MashRuntime.prototype._bindCalmControl = function () {
    const btn = this.calmBtn;
    const begin = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.pointerId != null && btn.setPointerCapture) {
        try {
          btn.setPointerCapture(e.pointerId);
        } catch (_) {
          /* ignore */
        }
      }
      if (this._calm) {
        this._calmHoldStart = performance.now();
        btn.classList.add("is-holding");
        const tick = () => {
          if (this._calmHoldStart == null) return;
          const t = (performance.now() - this._calmHoldStart) / PARENT_HOLD_MS;
          if (t >= 1) {
            this._calmHoldStart = null;
            this._calmHoldRaf = null;
            btn.classList.remove("is-holding");
            this._applyCalm(false, true);
            return;
          }
          this._calmHoldRaf = requestAnimationFrame(tick);
        };
        this._calmHoldRaf = requestAnimationFrame(tick);
      } else {
        this._applyCalm(true, true);
      }
    };
    const end = (e) => {
      e.stopPropagation();
      this._calmHoldStart = null;
      if (this._calmHoldRaf != null) {
        cancelAnimationFrame(this._calmHoldRaf);
        this._calmHoldRaf = null;
      }
      btn.classList.remove("is-holding");
    };
    btn.addEventListener("pointerdown", begin);
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointercancel", end);
    btn.addEventListener("lostpointercapture", end);
  };

  MashRuntime.prototype._applyCalm = function (on, softRestartAmbient) {
    this._calm = !!on;
    MashSounds.setCalm(this._calm);
    if (global.MashMotion) MashMotion.setCalm(this._calm);
    this.gameRoot.classList.toggle("is-calm", this._calm);
    this.calmBtn.classList.toggle("is-active", this._calm);
    this.calmBtn.setAttribute("aria-pressed", this._calm ? "true" : "false");
    this.calmBtn.title = this._calm ? "Hold to turn calm off" : "Tap for calm (quieter)";
    if (softRestartAmbient && this.live) {
      /* ambient respects calm on next bird/bubble tick; no full rebuild needed */
    }
  };

  MashRuntime.prototype._bindTimerControl = function () {
    this.timerBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    this.timerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Cycle: off → 5 → 10 → 15 → off
      const steps = [0, 5, 10, 15];
      const cur = this._debugWindDown ? -1 : this._sessionMinutes;
      this._debugWindDown = false;
      const idx = steps.indexOf(cur);
      const next = steps[(idx < 0 ? 1 : idx + 1) % steps.length];
      this._sessionMinutes = next;
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, String(next));
      } catch (_) {
        /* ignore */
      }
      this._syncTimerUi();
      if (this.live) this._armSessionTimer();
    });
  };

  MashRuntime.prototype._resolveSessionMinutes = function () {
    const params = new URLSearchParams(window.location.search);
    const windDownSec = parseFloat(params.get("windDownSec") || "");
    if (Number.isFinite(windDownSec) && windDownSec > 0) {
      // Test/debug: treat as fractional minutes so short timers work.
      this._sessionMinutes = windDownSec / 60;
      this._debugWindDown = true;
      return;
    }
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored != null && stored !== "") {
        const n = Number(stored);
        if (Number.isFinite(n) && n >= 0 && n <= 60) {
          this._sessionMinutes = n;
          return;
        }
      }
    } catch (_) {
      /* ignore */
    }
    const fromSpec =
      this.spec.parent && typeof this.spec.parent.sessionMinutes === "number"
        ? this.spec.parent.sessionMinutes
        : DEFAULT_SESSION_MINUTES;
    this._sessionMinutes = fromSpec;
  };

  MashRuntime.prototype._syncTimerUi = function () {
    const on = this._sessionMinutes > 0;
    this.timerBtn.classList.toggle("is-active", on);
    this.timerBtn.setAttribute("aria-pressed", on ? "true" : "false");
    if (!on) {
      this.timerBtn.textContent = "⏱";
      this.timerBtn.title = "Session timer off — tap to enable";
      return;
    }
    const label =
      this._sessionMinutes < 1
        ? Math.round(this._sessionMinutes * 60) + "s"
        : Math.round(this._sessionMinutes) + "m";
    this.timerBtn.textContent = this._debugWindDown ? "⏱" : "⏱";
    this.timerBtn.title = "Rest after " + label + " — tap to change";
    this.timerBtn.dataset.minutes = String(this._sessionMinutes);
  };

  MashRuntime.prototype._clearSessionTimers = function () {
    if (this._sessionTimerId != null) {
      clearTimeout(this._sessionTimerId);
      this._sessionTimerId = null;
    }
    if (this._windDownTimerId != null) {
      clearTimeout(this._windDownTimerId);
      this._windDownTimerId = null;
    }
    if (this._idleTimerId != null) {
      clearInterval(this._idleTimerId);
      this._idleTimerId = null;
    }
  };

  MashRuntime.prototype._armSessionTimer = function () {
    if (this._sessionTimerId != null) {
      clearTimeout(this._sessionTimerId);
      this._sessionTimerId = null;
    }
    if (!this.live || this._sessionMinutes <= 0 || this._windingDown) return;
    const ms = Math.max(1000, this._sessionMinutes * 60 * 1000);
    this._sessionTimerId = setTimeout(() => this._beginWindDown(), ms);
  };

  MashRuntime.prototype._beginWindDown = function () {
    if (!this.live || this._windingDown) return;
    this._windingDown = true;
    this._sessionTimerId = null;
    this.gameRoot.classList.add("is-resting");
    this.restOverlay.hidden = false;
    this.restOverlay.classList.add("is-visible");
    // Soften sensory load during wind-down
    if (!this._calm) this._applyCalm(true, false);
    MashSounds.setCalm(true);
    this.hint.textContent = "";
    const showGrace = !this._graceUsed;
    this.restGraceBtn.hidden = !showGrace;
    this._windDownTimerId = setTimeout(() => {
      this._windDownTimerId = null;
      this.stop();
    }, WIND_DOWN_MS);
  };

  MashRuntime.prototype._useGraceExtension = function () {
    if (!this._windingDown || this._graceUsed) return;
    this._graceUsed = true;
    this.restGraceBtn.hidden = true;
    this._windingDown = false;
    this.gameRoot.classList.remove("is-resting");
    this.restOverlay.classList.remove("is-visible");
    this.restOverlay.hidden = true;
    this.hint.textContent = "Mash anywhere!";
    if (this._windDownTimerId != null) {
      clearTimeout(this._windDownTimerId);
      this._windDownTimerId = null;
    }
    // One short extension, then wind-down again (no second grace).
    const graceMs = this._debugWindDown
      ? Math.max(8000, this._sessionMinutes * 60 * 1000)
      : GRACE_EXTRA_MS;
    this._sessionTimerId = setTimeout(() => this._beginWindDown(), graceMs);
  };

  MashRuntime.prototype._noteInteract = function () {
    this._lastInteractAt = performance.now();
    this._idleFired = false;
  };

  /** Light hook for future attract-mode idle toys (bucket 3). */
  MashRuntime.prototype._armIdleHook = function () {
    if (this._idleTimerId != null) clearInterval(this._idleTimerId);
    this._lastInteractAt = performance.now();
    this._idleFired = false;
    this._idleTimerId = setInterval(() => {
      if (!this.live || this._windingDown || this._idleFired) return;
      if (performance.now() - this._lastInteractAt < IDLE_ATTRACT_MS) return;
      this._idleFired = true;
      try {
        window.parent.postMessage({ type: "mash:idle" }, "*");
      } catch (_) {
        /* ignore */
      }
      if (typeof this.onIdle === "function") this.onIdle();
    }, 2000);
  };

  MashRuntime.prototype._syncOrientationHint = function () {
    if (!this.orientHint || this._orientDismissed) return;
    const portrait = window.matchMedia("(orientation: portrait)").matches;
    const narrow = Math.min(window.innerWidth, window.innerHeight) < 520;
    // Soft tip only — never hard-lock; scenes already scale responsively.
    this.orientHint.hidden = !(portrait && narrow && this.live);
  };

  MashRuntime.prototype._localPoint = function (e) {
    const rect = this.gameRoot.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  MashRuntime.prototype._flashAt = function (x, y, strong) {
    if (!this.stage) return;
    const flash = document.createElement("div");
    flash.className = "mash-flash" + (strong ? " mash-flash--strong" : "");
    if (this._calm || (global.MashMotion && MashMotion.reduced())) {
      flash.classList.add("mash-flash--soft");
    }
    flash.style.left = x + "px";
    flash.style.top = y + "px";
    this.stage.appendChild(flash);
    window.setTimeout(() => flash.remove(), this._calm ? 280 : 420);
  };

  MashRuntime.prototype._noteBurst = function () {
    const now = performance.now();
    this.burstTimestamps = this.burstTimestamps.filter((t) => now - t < BURST_WINDOW_MS);
    this.burstTimestamps.push(now);
    return this.burstTimestamps.length;
  };

  MashRuntime.prototype._onPointerDown = function (e) {
    if (!this.live) return;
    if (e.target.closest(".hud__parent, .kid-palette, .kid-toggle, .rest-overlay, .wish-overlay")) return;
    e.preventDefault();
    const pt = this._localPoint(e);
    this.activePointers.set(e.pointerId, { x: pt.x, y: pt.y, lastSpawnX: pt.x, lastSpawnY: pt.y });
    const burst = this._noteBurst();
    this.onMash({ x: pt.x, y: pt.y, burst, fromDrag: false });
  };

  MashRuntime.prototype._onPointerMove = function (e) {
    if (!this.live) return;
    const state = this.activePointers.get(e.pointerId);
    if (!state) return;
    const pt = this._localPoint(e);
    const dx = pt.x - state.lastSpawnX;
    const dy = pt.y - state.lastSpawnY;
    if (dx * dx + dy * dy < DRAG_SPAWN_GAP_PX * DRAG_SPAWN_GAP_PX) {
      state.x = pt.x;
      state.y = pt.y;
      return;
    }
    state.x = pt.x;
    state.y = pt.y;
    state.lastSpawnX = pt.x;
    state.lastSpawnY = pt.y;
    this.onMash({ x: pt.x, y: pt.y, burst: this._noteBurst(), fromDrag: true });
  };

  MashRuntime.prototype._onPointerUp = function (e) {
    this.activePointers.delete(e.pointerId);
  };

  MashRuntime.prototype.start = async function () {
    await MashSounds.resume();
    await enterFullscreen();
    const built = MashScene.render(this.sceneRoot, this.spec);
    this.root = this.gameRoot;
    this.stage = built.stage;
    this.spawnZone = built.spawnZone;
    this.gate.hidden = true;
    this.gameRoot.hidden = false;
    this.live = true;
    this.treats = [];
    this.actorCount = 0;
    this.spawnCount = 0;
    this.activePointers.clear();
    this._windingDown = false;
    this._graceUsed = false;
    this.gameRoot.classList.remove("is-resting");
    if (this.restOverlay) {
      this.restOverlay.hidden = true;
      this.restOverlay.classList.remove("is-visible");
    }
    this.hint.textContent = "Mash anywhere!";
    this._mountCustomize();
    MashAmbient.start(this);
    this._syncOrientationHint();
    this._armSessionTimer();
    this._armIdleHook();
    this._noteInteract();
  };

  MashRuntime.prototype.resetScene = function () {
    if (!this.live) return;
    this.sceneRoot.innerHTML = "";
    this.treats = [];
    this.actorCount = 0;
    this.spawnCount = 0;
    this.activePointers.clear();
    const built = MashScene.render(this.sceneRoot, this.spec);
    this.stage = built.stage;
    this.spawnZone = built.spawnZone;
    this._mountCustomize();
    MashAmbient.start(this);
    MashSounds.playFeedback("pop");
    this._flashAt(this.gameRoot.clientWidth / 2, this.gameRoot.clientHeight / 2, true);
  };

  MashRuntime.prototype._mountCustomize = function () {
    this._destroyCustomize();
    if (!global.MashCustomize || !this.spec.customize) return;
    const self = this;
    this.customize = MashCustomize.mount(this.gameRoot, this.spec, {
      themeRoot: this.sceneRoot,
      onThemeChange(theme) {
        self.spec = Object.assign({}, self.spec, { theme: Object.assign({}, self.spec.theme, theme) });
      },
    });
    if (this.customize.applyPersistedTheme) this.customize.applyPersistedTheme();
  };

  MashRuntime.prototype._destroyCustomize = function () {
    if (this.customize && typeof this.customize.destroy === "function") {
      this.customize.destroy();
    }
    this.customize = null;
  };

  MashRuntime.prototype._mountWishes = function () {
    this._destroyWishes();
    if (!global.MashWishes || typeof MashWishes.mount !== "function") return;
    this.wishes = MashWishes.mount(this);
  };

  MashRuntime.prototype._destroyWishes = function () {
    if (this.wishes && typeof this.wishes.destroy === "function") {
      this.wishes.destroy();
    }
    this.wishes = null;
  };

  MashRuntime.prototype.stop = async function () {
    this.live = false;
    this._cancelExitHold();
    this._clearSessionTimers();
    this._windingDown = false;
    if (this.wishes && typeof this.wishes.close === "function") this.wishes.close();
    this._destroyCustomize();
    this.activePointers.clear();
    await exitFullscreen();
    this.sceneRoot.innerHTML = "";
    this.treats = [];
    this.actorCount = 0;
    this.spawnCount = 0;
    this.gameRoot.classList.remove("is-resting");
    if (this.restOverlay) {
      this.restOverlay.hidden = true;
      this.restOverlay.classList.remove("is-visible");
    }
    this.gameRoot.hidden = true;
    this.gate.hidden = false;
    if (this.orientHint) this.orientHint.hidden = true;
    if (typeof this.onExit === "function") this.onExit();
  };

  MashRuntime.prototype.destroy = function () {
    this.live = false;
    this._cancelExitHold();
    this._clearSessionTimers();
    this._destroyWishes();
    this._destroyCustomize();
    window.removeEventListener("keydown", this._boundKey, true);
    window.removeEventListener("keyup", this._boundKeyUp, true);
    window.removeEventListener("orientationchange", this._boundOrient);
    window.removeEventListener("resize", this._boundOrient);
  };

  MashRuntime.prototype.maybeSendActor = function () {
    const actors = this.spec.actors || [];
    if (!actors.length) return;
    const ready = this.treats.filter((t) => t.ready && !t.claimed && t.el.isConnected);
    if (!ready.length) return;
    const actorDef = actors[Math.floor(Math.random() * actors.length)];
    const max = actorDef.max || 8;
    if (this.actorCount >= max) {
      window.setTimeout(() => this.maybeSendActor(), 800);
      return;
    }
    const target = ready[Math.floor(Math.random() * ready.length)];
    target.claimed = true;
    MashSpawn.sendActor(this, actorDef, target);
  };

  /**
   * @param {{x?:number,y?:number,burst?:number,fromDrag?:boolean}|undefined} opts
   */
  MashRuntime.prototype.onMash = function (opts) {
    if (!this.live) return;
    opts = opts || {};
    this._noteInteract();
    const limits = this.spec.limits || {};
    const maxSpawns = limits.maxSpawns || 18;
    let cooldown = limits.spawnCooldownMs || 90;
    if (this._calm) cooldown = Math.max(cooldown, 160);
    const now = performance.now();
    const x =
      typeof opts.x === "number" ? opts.x : this.gameRoot.clientWidth * (0.35 + Math.random() * 0.3);
    const y =
      typeof opts.y === "number" ? opts.y : this.gameRoot.clientHeight * (0.45 + Math.random() * 0.25);
    const burst = opts.burst || 1;

    // During wind-down: soft flash only — no new spawns / storms.
    if (this._windingDown) {
      this._flashAt(x, y, false);
      MashSounds.playFeedback("thud");
      return;
    }

    const active =
      this.spawnCount + this.treats.filter((t) => t.el && t.el.isConnected).length;
    const cooling = now - this.lastSpawn < cooldown;
    const atCap = active >= maxSpawns;

    // Always give visible feedback — never a dead tap.
    this._flashAt(x, y, burst >= 3 || atCap);

    if (cooling || atCap) {
      MashSounds.playFeedback("thud");
      return;
    }

    this.lastSpawn = now;
    MashSounds.playFeedback("pop");

    const items = this.spec.onMash || [];
    if (!items.length) return;
    const picked = pickWeighted(items);
    let kind = picked.kind;
    if (!MashEntities.meta(kind, this.spec.customEntities)) kind = "star";
    MashSpawn.spawnOne(this, kind);
    this.maybeSendActor();

    // Palm-slam: extra visual sparkles, not overlapping spawn storms.
    // Calm mode: skip burst sparkles to keep sensory load low.
    if (burst >= 3 && !this._calm) {
      for (let i = 0; i < Math.min(burst - 1, 4); i++) {
        const ox = x + (Math.random() - 0.5) * 70;
        const oy = y + (Math.random() - 0.5) * 70;
        window.setTimeout(() => this._flashAt(ox, oy, false), 30 + i * 40);
      }
    }
  };

  MashRuntime.prototype._onKey = function (e) {
    if (!this.live) return;
    // Wish overlay owns Escape / typing while open
    if (this.gameRoot && this.gameRoot.classList.contains("is-wishing")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (this.escHoldStart == null) {
        this.escHoldStart = performance.now();
        this._startExitHold();
      }
      // Progress ring + RAF in _startExitHold complete the exit at 2s.
      return;
    }
    if (e.key === "F11" || (e.altKey && (e.key === "F4" || e.key === "Tab"))) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    this.onMash({ burst: this._noteBurst() });
  };

  MashRuntime.prototype._onKeyUp = function (e) {
    if (e.key === "Escape") {
      this.escHoldStart = null;
      this._cancelExitHold();
    }
  };

  MashRuntime.prototype.applySpec = function (raw) {
    const spec = global.MashValidate ? MashValidate.sanitize(raw) : raw;
    this.spec = spec;
    MashScene.applyTheme(this.mount, spec.theme || {});
    if (this.gate) {
      this.mount.querySelector(".gate__brand").textContent = spec.brand || "mashbaby";
      this.mount.querySelector(".gate__title").textContent = spec.title || "Mash Game";
      this.mount.querySelector(".gate__copy").textContent = spec.copy || "Mash anywhere!";
    }
    if (this.live) {
      this.sceneRoot.innerHTML = "";
      this.treats = [];
      this.actorCount = 0;
      this.spawnCount = 0;
      const built = MashScene.render(this.sceneRoot, this.spec);
      this.stage = built.stage;
      this.spawnZone = built.spawnZone;
      this._mountCustomize();
      MashAmbient.start(this);
    }
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function enterFullscreen() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (req) return Promise.resolve(req.call(el)).catch(() => {});
    return Promise.resolve();
  }

  function exitFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (exit && document.fullscreenElement) {
      return Promise.resolve(exit.call(document)).catch(() => {});
    }
    return Promise.resolve();
  }

  async function loadSpec(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load spec: ${url}`);
    return res.json();
  }

  async function loadSpecSafe(url) {
    try {
      const raw = await loadSpec(url);
      return MashValidate.sanitize(raw);
    } catch (_) {
      return MashValidate.sanitize(MashValidate.FALLBACK_SPEC);
    }
  }

  /**
   * Boot never throws a toddler-facing error. Bad/missing specs fall back to cookies.
   */
  async function bootFromQuery(mount) {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session");
    const specUrl = params.get("spec");
    const wishToken = params.get("wish");
    let spec;
    let fromWishUrl = false;

    // Shared “look what we made” link wins over pack defaults / local restore.
    if (wishToken && global.MashWishes && typeof MashWishes.decodeWishSpec === "function") {
      const decoded = MashWishes.decodeWishSpec(wishToken);
      if (decoded && MashValidate.isUsable(decoded)) {
        spec = MashValidate.sanitize(decoded);
        fromWishUrl = true;
      }
    }

    if (!spec) {
      try {
        if (sessionId) {
          const res = await fetch(`/api/session/${sessionId}`);
          if (!res.ok) throw new Error("Session not found");
          const data = await res.json();
          spec = MashValidate.sanitize(data.spec);
        } else if (specUrl) {
          spec = await loadSpecSafe(specUrl);
        } else {
          spec = await loadSpecSafe(FALLBACK_SPEC_URL);
        }
      } catch (_) {
        spec = MashValidate.sanitize(MashValidate.FALLBACK_SPEC);
      }
    }

    if (!MashValidate.isUsable(spec)) {
      spec = MashValidate.sanitize(MashValidate.FALLBACK_SPEC);
    }

    // Restore last parent wish for this pack (local only; no accounts).
    if (!fromWishUrl && !sessionId && global.MashWishes && typeof MashWishes.loadPersisted === "function") {
      const saved = MashWishes.loadPersisted(spec.id);
      if (saved && MashValidate.isUsable(saved)) {
        spec = MashValidate.sanitize(saved);
      }
    }

    const rt = new MashRuntime({
      spec,
      mount,
      onExit: () => {
        if (window.parent !== window) {
          window.parent.postMessage({ type: "mash:exit" }, "*");
        } else {
          window.location.href = "../index.html";
        }
      },
    });
    rt.mountUI();
    window.mashRuntime = rt;
    window.addEventListener("message", (ev) => {
      if (ev.data && ev.data.type === "mash:applySpec" && ev.data.spec) {
        rt.applySpec(ev.data.spec);
      }
    });
    return rt;
  }

  global.MashRuntime = MashRuntime;
  global.MashBoot = { bootFromQuery, loadSpec, loadSpecSafe };
})(window);

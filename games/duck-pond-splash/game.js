(() => {
  "use strict";

  const MAX_DUCKS = 10;
  const EXIT_HOLD_MS = 2000;
  const SWIM_MS_MIN = 2200;
  const SWIM_MS_MAX = 3800;

  const gate = document.getElementById("start-gate");
  const startBtn = document.getElementById("start-btn");
  const gameRoot = document.getElementById("game-root");
  const stage = document.getElementById("stage");
  const pond = document.getElementById("pond");
  const hint = document.getElementById("hint");
  const exitBtn = document.getElementById("exit-btn");

  let gameLive = false;
  let duckCount = 0;
  let escHoldStart = null;
  let lastSpawn = 0;

  const looks = [
    { body: "#ffe066", wing: "#f0c830", beak: "#ff8a3a", eye: "#2a2a2a" },
    { body: "#fff0c8", wing: "#e8d090", beak: "#ff9a4a", eye: "#2a2a2a" },
    { body: "#ffd24a", wing: "#e0a820", beak: "#ff7040", eye: "#2a2a2a" },
    { body: "#fff6e0", wing: "#f0e0b0", beak: "#ffb040", eye: "#2a2a2a" },
  ];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function duckSvg(look) {
    const { body, wing, beak, eye } = look;
    return `
      <svg class="duck__svg" viewBox="0 0 110 90" aria-hidden="true">
        <ellipse cx="52" cy="58" rx="34" ry="22" fill="${body}"/>
        <ellipse cx="52" cy="58" rx="26" ry="14" fill="#fff" opacity="0.18"/>
        <ellipse cx="68" cy="52" rx="16" ry="12" fill="${wing}"/>
        <circle cx="78" cy="36" r="18" fill="${body}"/>
        <circle cx="86" cy="32" r="3.2" fill="${eye}"/>
        <circle cx="87" cy="31" r="1.1" fill="#fff"/>
        <path d="M94 36 L108 34 L94 42 Z" fill="${beak}"/>
        <ellipse cx="38" cy="72" rx="10" ry="5" fill="${beak}" opacity="0.85"/>
        <ellipse cx="58" cy="74" rx="10" ry="5" fill="${beak}" opacity="0.85"/>
      </svg>`;
  }

  function pondRect() {
    const r = pond.getBoundingClientRect();
    const root = gameRoot.getBoundingClientRect();
    return {
      left: r.left - root.left,
      top: r.top - root.top,
      width: r.width,
      height: r.height,
    };
  }

  function spawnDuck() {
    if (!gameLive) return;
    if (duckCount >= MAX_DUCKS) return;

    const now = performance.now();
    if (now - lastSpawn < 100) return;
    lastSpawn = now;

    const p = pondRect();
    const landX = p.left + rand(p.width * 0.15, p.width * 0.85);
    const landY = p.top + rand(p.height * 0.25, p.height * 0.75);
    const fromLeft = Math.random() < 0.5;
    const face = fromLeft ? 1 : -1;
    const exitX = fromLeft ? p.left + p.width + 80 : p.left - 80;
    const exitY = landY + rand(-30, 40);
    const swimMs = rand(SWIM_MS_MIN, SWIM_MS_MAX);
    const look = pick(looks);

    const el = document.createElement("div");
    el.className = "duck is-dropping";
    el.style.transform = `translate(${landX}px, ${landY}px) scaleX(${face})`;
    el.innerHTML = duckSvg(look);
    stage.appendChild(el);
    duckCount += 1;

    spawnRipple(landX, landY);
    GameSounds.playSplash();

    window.setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.remove("is-dropping");
      el.classList.add("is-swimming");
      GameSounds.playQuack();
      window.setTimeout(() => GameSounds.playQuack(), 280);
      GameSounds.playSwim();

      const swim = el.animate(
        [
          { transform: `translate(${landX}px, ${landY}px) scaleX(${face})` },
          { transform: `translate(${(landX + exitX) / 2}px, ${landY + rand(-20, 20)}px) scaleX(${face})` },
          { transform: `translate(${exitX}px, ${exitY}px) scaleX(${face})` },
        ],
        { duration: swimMs, easing: "ease-in-out", fill: "forwards" }
      );

      window.setTimeout(() => {
        if (el.isConnected) GameSounds.playSwim();
      }, swimMs * 0.45);

      swim.onfinish = () => {
        if (el.isConnected) el.remove();
        duckCount = Math.max(0, duckCount - 1);
      };
    }, 450);
  }

  function spawnRipple(x, y) {
    for (let i = 0; i < 2; i++) {
      const ripple = document.createElement("div");
      ripple.className = "ripple";
      ripple.style.left = `${x + rand(-8, 8)}px`;
      ripple.style.top = `${y + 10 + i * 4}px`;
      ripple.style.animationDelay = `${i * 0.08}s`;
      stage.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 720);
    }
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

  async function startGame() {
    await GameSounds.resume();
    await enterFullscreen();
    gate.hidden = true;
    gameRoot.hidden = false;
    gameLive = true;
    hint.textContent = "Mash any key!";
  }

  async function stopGame() {
    gameLive = false;
    await exitFullscreen();
    stage.innerHTML = "";
    duckCount = 0;
    gameRoot.hidden = true;
    gate.hidden = false;
    window.location.href = "../../index.html";
  }

  function onKey(e) {
    if (!gameLive) return;

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (escHoldStart == null) escHoldStart = performance.now();
      if (performance.now() - escHoldStart >= EXIT_HOLD_MS) {
        escHoldStart = null;
        stopGame();
      }
      return;
    }

    if (e.key === "F11" || (e.altKey && (e.key === "F4" || e.key === "Tab"))) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    try {
      GameSounds.playKeyPop();
    } catch (_) {
      /* ignore */
    }
    spawnDuck();
  }

  function onKeyUp(e) {
    if (e.key === "Escape") escHoldStart = null;
  }

  function onPointer() {
    if (!gameLive) return;
    try {
      GameSounds.playKeyPop();
    } catch (_) {
      /* ignore */
    }
    spawnDuck();
  }

  startBtn.addEventListener("click", () => {
    startGame();
  });

  exitBtn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    const t0 = performance.now();
    const onUp = () => {
      window.removeEventListener("pointerup", onUp);
      if (performance.now() - t0 >= 600) stopGame();
    };
    window.addEventListener("pointerup", onUp);
  });

  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", onKeyUp, true);
  gameRoot.addEventListener("pointerdown", onPointer);

  document.addEventListener("fullscreenchange", () => {
    if (gameLive && !document.fullscreenElement) {
      hint.textContent = "Tap the screen for full screen!";
      const once = () => {
        enterFullscreen();
        hint.textContent = "Mash any key!";
        gameRoot.removeEventListener("pointerdown", once);
      };
      gameRoot.addEventListener("pointerdown", once);
    }
  });

  window.addEventListener("contextmenu", (e) => e.preventDefault());
})();

(() => {
  "use strict";

  const MAX_BALLOONS = 14;
  const EXIT_HOLD_MS = 2000;
  const INFLATE_MS = 520;
  const FLOAT_MS_MIN = 1800;
  const FLOAT_MS_MAX = 3200;

  const gate = document.getElementById("start-gate");
  const startBtn = document.getElementById("start-btn");
  const gameRoot = document.getElementById("game-root");
  const stage = document.getElementById("stage");
  const hint = document.getElementById("hint");
  const exitBtn = document.getElementById("exit-btn");

  let gameLive = false;
  let balloonCount = 0;
  let escHoldStart = null;
  let lastSpawn = 0;

  const palettes = [
    { body: "#ff6b9d", shine: "#ffd0e0", string: "#c44a72" },
    { body: "#5ab0ff", shine: "#d0ecff", string: "#2a78c4" },
    { body: "#ffe066", shine: "#fff6c8", string: "#d4a020" },
    { body: "#b8e986", shine: "#e8ffd0", string: "#5a9a3a" },
    { body: "#c49bff", shine: "#eee0ff", string: "#7a4ec4" },
    { body: "#ff9a5a", shine: "#ffe0c8", string: "#c45a20" },
  ];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function balloonSvg(palette) {
    const { body, shine, string } = palette;
    return `
      <svg class="balloon__svg" viewBox="0 0 90 120" aria-hidden="true">
        <ellipse cx="45" cy="48" rx="32" ry="40" fill="${body}"/>
        <ellipse cx="34" cy="36" rx="10" ry="14" fill="${shine}" opacity="0.55"/>
        <path d="M40 88 L45 96 L50 88 Z" fill="${body}"/>
        <path d="M45 96 C42 104, 48 110, 45 118" fill="none" stroke="${string}" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
  }

  function spawnBalloon() {
    if (!gameLive) return;
    if (balloonCount >= MAX_BALLOONS) return;

    const now = performance.now();
    if (now - lastSpawn < 90) return;
    lastSpawn = now;

    const width = gameRoot.clientWidth;
    const height = gameRoot.clientHeight;
    const startX = rand(width * 0.12, width * 0.88);
    const startY = height * 0.78 + rand(-20, 30);
    const endX = startX + rand(-80, 80);
    const endY = rand(height * 0.08, height * 0.32);
    const palette = pick(palettes);
    const floatMs = rand(FLOAT_MS_MIN, FLOAT_MS_MAX);

    const el = document.createElement("div");
    el.className = "balloon is-inflating";
    el.style.transform = `translate(${startX}px, ${startY}px)`;
    el.innerHTML = balloonSvg(palette);
    stage.appendChild(el);
    balloonCount += 1;

    GameSounds.playInflate();

    window.setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.remove("is-inflating");
      el.classList.add("is-floating");
      GameSounds.playFloat();

      const float = el.animate(
        [
          { transform: `translate(${startX}px, ${startY}px)` },
          { transform: `translate(${endX}px, ${endY}px)` },
        ],
        { duration: floatMs, easing: "ease-out", fill: "forwards" }
      );

      float.onfinish = () => {
        if (!el.isConnected) return;
        popBalloon(el, endX, endY);
      };
    }, INFLATE_MS);
  }

  function popBalloon(el, x, y) {
    el.classList.remove("is-floating");
    el.classList.add("is-popping");
    GameSounds.playPop();
    spawnSparks(x, y);

    window.setTimeout(() => {
      if (el.isConnected) el.remove();
      balloonCount = Math.max(0, balloonCount - 1);
    }, 340);
  }

  function spawnSparks(x, y) {
    const colors = ["#ff6b9d", "#5ab0ff", "#ffe066", "#b8e986", "#c49bff", "#fff"];
    for (let i = 0; i < 10; i++) {
      const spark = document.createElement("div");
      spark.className = "spark";
      spark.style.left = `${x}px`;
      spark.style.top = `${y}px`;
      spark.style.background = pick(colors);
      spark.style.setProperty("--dx", `${rand(-70, 70)}px`);
      spark.style.setProperty("--dy", `${rand(-70, 50)}px`);
      stage.appendChild(spark);
      window.setTimeout(() => spark.remove(), 560);
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
    balloonCount = 0;
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
    spawnBalloon();
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
    spawnBalloon();
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

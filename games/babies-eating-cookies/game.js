(() => {
  "use strict";

  const BAKE_MS = 3200;
  const MAX_TREATS = 18;
  const MAX_BABIES = 8;
  const EXIT_HOLD_MS = 2000;
  const MUNCH_MS = 1400;
  const ICE_CREAM_CHANCE = 0.35;

  const gate = document.getElementById("start-gate");
  const startBtn = document.getElementById("start-btn");
  const gameRoot = document.getElementById("game-root");
  const stage = document.getElementById("stage");
  const pan = document.getElementById("cookie-pan");
  const hint = document.getElementById("hint");
  const exitBtn = document.getElementById("exit-btn");

  /** @type {{ el: HTMLElement, x: number, y: number, ready: boolean, claimed: boolean, kind: 'cookie'|'icecream' }[]} */
  let treats = [];
  let gameLive = false;
  let babyCount = 0;
  let escHoldStart = null;
  let lastSpawn = 0;

  const babyLooks = [
    { skin: "#f7c9a8", onesie: "#ff8fab", cheeks: "#ff9aa8", hair: "#5a3a22" },
    { skin: "#e8b089", onesie: "#7ec8ff", cheeks: "#f08a9a", hair: "#2a1a12" },
    { skin: "#c88a5a", onesie: "#b8e986", cheeks: "#e07888", hair: "#1a1008" },
    { skin: "#f2d2b0", onesie: "#d4a5ff", cheeks: "#ff9eb0", hair: "#8b5a2b" },
    { skin: "#d4a574", onesie: "#ffe066", cheeks: "#f090a0", hair: "#3d2314" },
  ];

  const iceFlavors = [
    { scoop: "#ff9ec5", scoop2: "#fff0f6", sprinkle: "#c49bff" },
    { scoop: "#c49bff", scoop2: "#f0e6ff", sprinkle: "#ff9ec5" },
    { scoop: "#fff6e0", scoop2: "#ffe4a8", sprinkle: "#7ec8ff" },
    { scoop: "#a8e6ff", scoop2: "#e8f9ff", sprinkle: "#ff8fab" },
    { scoop: "#b8e986", scoop2: "#f0ffe0", sprinkle: "#ff9ec5" },
  ];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function cookieSvg(stageName) {
    const fill =
      stageName === "ready" ? "#c47a3a" : stageName === "baking" ? "#e8b86a" : "#f3d8a6";
    const rim =
      stageName === "ready" ? "#a05a28" : stageName === "baking" ? "#d4a05a" : "#e8c98a";
    const chipOp = stageName === "dough" ? 0.35 : 1;
    return `
      <svg class="cookie__svg" viewBox="0 0 72 72" aria-hidden="true">
        <ellipse cx="36" cy="40" rx="28" ry="26" fill="#c47a3a" opacity="0.18"/>
        <circle cx="36" cy="36" r="28" fill="${rim}"/>
        <circle cx="36" cy="36" r="25" fill="${fill}"/>
        <circle cx="22" cy="28" r="3.2" fill="#5a3018" opacity="${chipOp}"/>
        <circle cx="38" cy="22" r="2.8" fill="#4a2814" opacity="${chipOp}"/>
        <circle cx="50" cy="30" r="3" fill="#5a3018" opacity="${chipOp}"/>
        <circle cx="28" cy="42" r="2.6" fill="#4a2814" opacity="${chipOp}"/>
        <circle cx="44" cy="44" r="3.4" fill="#5a3018" opacity="${chipOp}"/>
        <circle cx="34" cy="34" r="2.4" fill="#4a2814" opacity="${chipOp}"/>
        <circle cx="48" cy="40" r="2.2" fill="#5a3018" opacity="${chipOp}"/>
        <path d="M18 32c2-6 8-8 12-4" fill="none" stroke="${rim}" stroke-width="2" stroke-linecap="round" opacity="0.55"/>
      </svg>`;
  }

  function iceCreamSvg(flavor) {
    const { scoop, scoop2, sprinkle } = flavor;
    return `
      <svg class="icecream__svg" viewBox="0 0 64 84" aria-hidden="true">
        <ellipse cx="32" cy="74" rx="10" ry="4" fill="#c47a3a" opacity="0.2"/>
        <path d="M20 48 L32 80 L44 48 Z" fill="#f2c78a"/>
        <path d="M22 50 L32 76 L42 50" fill="none" stroke="#d4a05a" stroke-width="1.5" opacity="0.55"/>
        <circle cx="24" cy="38" r="13" fill="${scoop}"/>
        <circle cx="40" cy="36" r="12" fill="${scoop2}"/>
        <circle cx="32" cy="28" r="13" fill="${scoop}"/>
        <circle cx="28" cy="24" r="3" fill="#fff" opacity="0.55"/>
        <circle cx="38" cy="22" r="2.2" fill="#fff" opacity="0.45"/>
        <circle cx="30" cy="34" r="1.8" fill="${sprinkle}"/>
        <circle cx="38" cy="32" r="1.6" fill="${sprinkle}"/>
        <circle cx="34" cy="38" r="1.4" fill="#ffe066"/>
        <circle cx="26" cy="40" r="1.5" fill="${sprinkle}"/>
      </svg>`;
  }

  function babySvg(look) {
    const { skin, onesie, cheeks, hair } = look;
    return `
      <svg class="baby__svg" viewBox="0 0 130 110" aria-hidden="true">
        <ellipse cx="68" cy="72" rx="34" ry="26" fill="${onesie}"/>
        <ellipse cx="68" cy="72" rx="28" ry="20" fill="#fff" opacity="0.18"/>
        <ellipse cx="92" cy="78" rx="14" ry="16" fill="${onesie}"/>
        <circle cx="48" cy="42" r="28" fill="${skin}"/>
        <path d="M30 30c4-14 22-18 34-8 2 1-2 4-6 5-8-6-18-4-24 2-2 1-5-1-4 0z" fill="${hair}"/>
        <circle cx="22" cy="44" r="7" fill="${skin}"/>
        <circle cx="74" cy="44" r="7" fill="${skin}"/>
        <circle cx="34" cy="50" r="7" fill="${cheeks}" opacity="0.7"/>
        <circle cx="62" cy="50" r="7" fill="${cheeks}" opacity="0.7"/>
        <path d="M34 40c2 4 8 4 10 0" fill="none" stroke="#3a2a1a" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M50 40c2 4 8 4 10 0" fill="none" stroke="#3a2a1a" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M40 52c3 6 13 6 16 0" fill="none" stroke="#c45a6a" stroke-width="2.6" stroke-linecap="round"/>
        <ellipse cx="30" cy="70" rx="12" ry="9" fill="${skin}" transform="rotate(-25 30 70)"/>
        <ellipse cx="88" cy="62" rx="11" ry="8" fill="${skin}" transform="rotate(30 88 62)"/>
        <circle cx="22" cy="76" r="8" fill="${skin}"/>
        <circle cx="96" cy="56" r="7.5" fill="${skin}"/>
        <ellipse cx="58" cy="94" rx="11" ry="8" fill="${skin}"/>
        <ellipse cx="82" cy="92" rx="11" ry="8" fill="${skin}"/>
        <ellipse cx="54" cy="100" rx="10" ry="6" fill="${onesie}"/>
        <ellipse cx="86" cy="98" rx="10" ry="6" fill="${onesie}"/>
      </svg>`;
  }

  function panRect() {
    const r = pan.getBoundingClientRect();
    const root = gameRoot.getBoundingClientRect();
    return {
      left: r.left - root.left,
      top: r.top - root.top,
      width: r.width,
      height: r.height,
    };
  }

  function spawnTreat() {
    if (!gameLive) return;
    if (treats.filter((t) => t.el.isConnected).length >= MAX_TREATS) return;

    const now = performance.now();
    if (now - lastSpawn < 90) return;
    lastSpawn = now;

    if (Math.random() < ICE_CREAM_CHANCE) {
      spawnIceCream();
    } else {
      spawnCookie();
    }
  }

  function spawnCookie() {
    const p = panRect();
    const x = p.left + rand(p.width * 0.12, p.width * 0.88);
    const y = p.top + rand(p.height * 0.25, p.height * 0.78);

    const el = document.createElement("div");
    el.className = "cookie is-dropping";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.innerHTML = cookieSvg("dough");
    stage.appendChild(el);

    GameSounds.playCookieDrop();

    const treat = { el, x, y, ready: false, claimed: false, kind: "cookie" };
    treats.push(treat);

    window.setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.remove("is-dropping");
      el.classList.add("is-baking");
      el.innerHTML = cookieSvg("baking");
    }, 450);

    window.setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.remove("is-baking");
      el.classList.add("is-ready");
      treat.ready = true;
      el.innerHTML = cookieSvg("ready");
      GameSounds.playOvenDing();
      maybeSendBaby();
    }, 450 + BAKE_MS);
  }

  function spawnIceCream() {
    const p = panRect();
    const x = p.left + rand(p.width * 0.12, p.width * 0.88);
    const y = p.top + rand(p.height * 0.2, p.height * 0.7);
    const flavor = pick(iceFlavors);

    const el = document.createElement("div");
    el.className = "icecream is-dropping";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.innerHTML = iceCreamSvg(flavor);
    stage.appendChild(el);

    GameSounds.playIceCreamDrop();

    const treat = { el, x, y, ready: false, claimed: false, kind: "icecream" };
    treats.push(treat);

    // Ice cream is ready fast — no bake wait
    window.setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.remove("is-dropping");
      el.classList.add("is-ready");
      treat.ready = true;
      maybeSendBaby();
    }, 520);
  }

  function maybeSendBaby() {
    const ready = treats.filter((t) => t.ready && !t.claimed && t.el.isConnected);
    if (!ready.length) return;
    if (babyCount >= MAX_BABIES) {
      window.setTimeout(maybeSendBaby, 800);
      return;
    }
    const target = pick(ready);
    target.claimed = true;
    sendBaby(target);
  }

  function sendBaby(treat) {
    babyCount += 1;
    const fromLeft = Math.random() < 0.5;
    const look = pick(babyLooks);
    const face = fromLeft ? 1 : -1;
    const crawlInMs = rand(1100, 1600);
    const crawlOutMs = rand(1000, 1500);
    const width = gameRoot.clientWidth;
    const height = gameRoot.clientHeight;

    const munchX = treat.x + rand(-12, 12);
    const munchY = treat.y + rand(-6, 18);
    const startX = fromLeft ? -80 : width + 80;
    const startY = Math.min(height * 0.78, munchY + rand(40, 90));
    const exitX = fromLeft ? width + 100 : -100;
    const exitY = startY + rand(-20, 40);

    const baby = document.createElement("div");
    baby.className = "baby is-crawling-in";
    baby.style.transform = `translate(${startX}px, ${startY}px) scaleX(${face})`;
    baby.innerHTML = babySvg(look);
    stage.appendChild(baby);

    GameSounds.playBabyArrive();

    const crawlIn = baby.animate(
      [
        { transform: `translate(${startX}px, ${startY}px) scaleX(${face})` },
        { transform: `translate(${munchX}px, ${munchY}px) scaleX(${face})` },
      ],
      { duration: crawlInMs, easing: "ease-in-out", fill: "forwards" }
    );

    crawlIn.onfinish = () => {
      if (!treat.el.isConnected) {
        baby.remove();
        babyCount -= 1;
        maybeSendBaby();
        return;
      }

      baby.classList.remove("is-crawling-in");
      baby.classList.add("is-munching");

      if (treat.kind === "icecream") {
        GameSounds.playLick();
        window.setTimeout(() => GameSounds.playLick(), 360);
        window.setTimeout(() => GameSounds.playMunch(), 700);
      } else {
        GameSounds.playMunch();
        window.setTimeout(() => GameSounds.playMunch(), 320);
        window.setTimeout(() => GameSounds.playMunch(), 640);
      }

      window.setTimeout(() => {
        if (treat.el.isConnected) {
          treat.el.classList.remove("is-ready", "is-baking", "is-dropping");
          treat.el.classList.add("is-eaten");
          window.setTimeout(() => {
            if (treat.el.isConnected) treat.el.remove();
          }, 550);
        }
        treats = treats.filter((t) => t !== treat);
      }, Math.floor(MUNCH_MS * 0.55));

      window.setTimeout(() => {
        baby.classList.remove("is-munching");
        baby.classList.add("is-crawling-out");

        const crawlOut = baby.animate(
          [
            { transform: `translate(${munchX}px, ${munchY}px) scaleX(${face})` },
            { transform: `translate(${exitX}px, ${exitY}px) scaleX(${face})` },
          ],
          { duration: crawlOutMs, easing: "ease-in", fill: "forwards" }
        );

        crawlOut.onfinish = () => {
          baby.remove();
          babyCount -= 1;
          maybeSendBaby();
        };
      }, MUNCH_MS);
    };
  }

  function enterFullscreen() {
    const el = document.documentElement;
    const req =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.msRequestFullscreen;
    if (req) return Promise.resolve(req.call(el)).catch(() => {});
    return Promise.resolve();
  }

  function exitFullscreen() {
    const exit =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.msExitFullscreen;
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
    treats = [];
    babyCount = 0;
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
      /* ignore audio glitches */
    }
    spawnTreat();
    maybeSendBaby();
  }

  function onKeyUp(e) {
    if (e.key === "Escape") escHoldStart = null;
  }

  function onPointer() {
    if (!gameLive) return;
    try {
      GameSounds.playKeyPop();
    } catch (_) {
      /* ignore audio glitches */
    }
    spawnTreat();
    maybeSendBaby();
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

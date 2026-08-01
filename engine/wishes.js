/**
 * Parent Wish box — co-creation wand inside play.
 * Catalog tweaks are free/unlimited; novel creations spend wish-jar credits.
 * Prefers POST /api/wish; offline catalog matcher covers common tweaks.
 */
(function (global) {
  "use strict";

  const WISH_HOLD_MS = 2000;
  const STORAGE_PREFIX = "mash:wishedSpec:";
  const CREDITS_KEY = "mash:wishCredits";
  const SEED_CREDITS = 5;
  const NOVEL_COST = 1;
  const HISTORY_MAX = 8;

  const COLORS = {
    pink: "#ff9ec5",
    "hot pink": "#ff6b9d",
    purple: "#c49bff",
    lavender: "#d4b0ff",
    blue: "#5ab0ff",
    "sky blue": "#7ec8ff",
    green: "#7bc96f",
    yellow: "#ffe066",
    orange: "#ff9a5a",
    red: "#ff6b6b",
    white: "#fff6e8",
    black: "#1a1218",
    brown: "#8b4a1f",
    cream: "#fff6e8",
    teal: "#4aa8d8",
  };

  const SPAWNS = {
    cookie: ["cookie", "cookies", "biscuit"],
    icecream: ["ice cream", "icecream", "ice-cream", "cone"],
    balloon: ["balloon", "balloons"],
    duck: ["duck", "ducks", "duckling"],
    mouse: ["mouse", "mice", "squeak", "cheese"],
    ball: ["ball", "balls"],
    star: ["star", "stars"],
  };

  const ACTORS = {
    baby: ["baby", "babies", "toddler", "kid"],
    dino: ["dino", "dinosaur", "dinosaurs", "t-rex", "trex"],
    puppy: ["puppy", "puppies", "dog", "dogs"],
  };

  const AMBIENT = {
    birds: ["bird", "birds", "flying birds"],
    clouds: ["cloud", "clouds"],
    bubbles: ["bubble", "bubbles"],
    sparkles: ["sparkle", "sparkles", "glitter"],
  };

  const CHIPS = [
    { text: "friendly monster", novel: true },
    { text: "turn it into space", novel: true },
    { text: "sparkly stars", novel: true },
    { text: "pink walls", novel: false },
    { text: "more ducks", novel: false },
    { text: "add birds", novel: false },
  ];

  const SUGGEST_FREE = ["pink walls", "more ducks", "add birds", "purple walls", "add balloons"];

  function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function mentions(text, labels) {
    const lower = text.toLowerCase();
    return labels.some((label) => new RegExp("\\b" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(lower));
  }

  function findColor(text) {
    const lower = text.toLowerCase().replace(/\bice[\s-]?cream\b/g, " ");
    const names = Object.keys(COLORS).sort((a, b) => b.length - a.length);
    for (const name of names) {
      if (new RegExp("\\b" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(lower)) {
        return COLORS[name];
      }
    }
    const hex = text.match(/#(?:[0-9a-fA-F]{3,8})\b/);
    return hex ? hex[0] : null;
  }

  function ensureSpawn(spec, kind) {
    const mash = spec.onMash || (spec.onMash = []);
    if (mash.some((item) => item.kind === kind)) return false;
    mash.push({ kind, weight: mash.length ? 40 : 100 });
    if (mash.length > 1) {
      const each = Math.max(1, Math.floor(100 / mash.length));
      mash.forEach((item) => {
        item.weight = each;
      });
    }
    return true;
  }

  function ensureActor(spec, kind) {
    const actors = spec.actors || (spec.actors = []);
    if (actors.some((a) => a.kind === kind)) return false;
    actors.push({ kind, behavior: "seek_and_munch", max: 8 });
    return true;
  }

  function ensureAmbient(spec, kind) {
    const ambient = spec.ambient || (spec.ambient = []);
    if (ambient.some((a) => a.kind === kind)) return false;
    ambient.push({ kind, count: kind === "birds" ? 4 : 3 });
    return true;
  }

  function setWallColor(spec, color) {
    const theme = spec.theme || (spec.theme = {});
    theme.wallColor = color;
    const dots = theme.wallDotColors || ["#ff9ec5", "#c49bff"];
    theme.wallDotColors = [color, dots[1] || "#ffffff"];
  }

  /** Offline catalog matcher — free tweaks only (no sad invent blob). */
  function applyOffline(spec, text) {
    const newSpec = deepCopy(spec);
    const lower = text.toLowerCase().trim();
    const color = findColor(lower);
    const wantsMore = /\b(more|another|extra)\b/.test(lower);

    if (color && (/\b(wall|walls|floor|sky|grass|water|paint|color|colour)\b/.test(lower) || lower.split(/\s+/).length <= 3)) {
      if (/\bfloor\b/.test(lower)) newSpec.theme = Object.assign({}, newSpec.theme, { floorColor: color });
      else if (/\bsky\b/.test(lower)) newSpec.theme = Object.assign({}, newSpec.theme, { skyTop: color, skyBot: color });
      else if (/\bgrass\b/.test(lower)) newSpec.theme = Object.assign({}, newSpec.theme, { grassColor: color });
      else if (/\bwater\b/.test(lower)) newSpec.theme = Object.assign({}, newSpec.theme, { waterColor: color });
      else setWallColor(newSpec, color);
      return { spec: newSpec, intent: "theme", note: "Colors changed!", path: "offline", novel: false };
    }

    let hit = false;
    for (const [kind, labels] of Object.entries(SPAWNS)) {
      if (!mentions(lower, labels)) continue;
      hit = true;
      const added = ensureSpawn(newSpec, kind);
      if (wantsMore || !added) {
        const limits = newSpec.limits || (newSpec.limits = {});
        limits.maxSpawns = Math.min(28, (limits.maxSpawns || 12) + 4);
      }
    }
    for (const [kind, labels] of Object.entries(ACTORS)) {
      if (!mentions(lower, labels)) continue;
      hit = true;
      const actors = newSpec.actors || (newSpec.actors = []);
      const existing = actors.find((a) => a.kind === kind);
      if (existing && wantsMore) existing.max = Math.min(16, (existing.max || 8) + 2);
      else ensureActor(newSpec, kind);
    }
    for (const [kind, labels] of Object.entries(AMBIENT)) {
      if (!mentions(lower, labels) && !(kind === "birds" && /\bbirds?\b/.test(lower))) continue;
      hit = true;
      const ambient = newSpec.ambient || (newSpec.ambient = []);
      const existing = ambient.find((a) => a.kind === kind);
      if (existing && wantsMore) existing.count = Math.min(12, (existing.count || 3) + 2);
      else ensureAmbient(newSpec, kind);
    }

    if (hit) {
      return {
        spec: newSpec,
        intent: wantsMore ? "more" : "catalog_add",
        note: wantsMore ? "More of that!" : "Added it to the mash mix!",
        path: "offline",
        novel: false,
      };
    }

    return {
      spec: newSpec,
      intent: "none",
      note: "That wish needs the magic helper. Try a free tweak below, or run ./server/run.sh for creations.",
      path: "offline",
      novel: false,
      suggestions: SUGGEST_FREE,
    };
  }

  async function requestWish(spec, text) {
    try {
      const res = await fetch("/api/wish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec, text }),
      });
      if (!res.ok) throw new Error("wish failed");
      const data = await res.json();
      const novel = !!(data.novel || (data.turn_usage && data.turn_usage.novel) || data.intent === "freewheel");
      return {
        spec: data.spec,
        intent: data.intent || "tweak",
        note: data.note || "Your wish came true!",
        path: (data.turn_usage && data.turn_usage.path) || "server",
        novel,
      };
    } catch (_) {
      return applyOffline(spec, text);
    }
  }

  function getCredits() {
    try {
      const raw = localStorage.getItem(CREDITS_KEY);
      if (raw == null || raw === "") {
        localStorage.setItem(CREDITS_KEY, String(SEED_CREDITS));
        return SEED_CREDITS;
      }
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? Math.max(0, n) : SEED_CREDITS;
    } catch (_) {
      return SEED_CREDITS;
    }
  }

  function setCredits(n) {
    const next = Math.max(0, Math.floor(n));
    try {
      localStorage.setItem(CREDITS_KEY, String(next));
    } catch (_) {
      /* ignore */
    }
    return next;
  }

  function spendCredit() {
    const cur = getCredits();
    if (cur < NOVEL_COST) return false;
    setCredits(cur - NOVEL_COST);
    return true;
  }

  function persist(spec) {
    if (!spec || !spec.id) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + spec.id, JSON.stringify(spec));
    } catch (_) {
      /* ignore */
    }
  }

  function loadPersisted(specId) {
    if (!specId) return null;
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + specId);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function encodeWishSpec(spec) {
    const json = JSON.stringify(spec);
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    bytes.forEach((b) => {
      bin += String.fromCharCode(b);
    });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeWishSpec(token) {
    if (!token) return null;
    try {
      let b64 = token.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (_) {
      return null;
    }
  }

  function shareUrlFor(spec) {
    const token = encodeWishSpec(spec);
    const url = new URL(window.location.href);
    url.searchParams.delete("session");
    url.searchParams.delete("spec");
    url.searchParams.set("wish", token);
    return url.toString();
  }

  function jarStars(n) {
    const filled = Math.min(5, Math.max(0, n));
    let s = "";
    for (let i = 0; i < 5; i++) s += i < filled ? "★" : "☆";
    return s;
  }

  function mount(runtime) {
    if (!runtime || !runtime.gameRoot || runtime._wishMounted) return null;

    const parentBar = runtime.mount.querySelector("#parent-bar");
    if (!parentBar) return null;
    runtime._wishMounted = true;

    const history = [];

    const wishBtn = document.createElement("button");
    wishBtn.id = "wish-btn";
    wishBtn.className = "hud__parent-btn hud__wish-btn";
    wishBtn.type = "button";
    wishBtn.title = "Hold ~2s for Wish (parents)";
    wishBtn.setAttribute("aria-label", "Hold to open Wish");
    wishBtn.textContent = "★";

    const exitBtn = parentBar.querySelector("#exit-btn");
    if (exitBtn) parentBar.insertBefore(wishBtn, exitBtn);
    else parentBar.appendChild(wishBtn);

    const overlay = document.createElement("div");
    overlay.id = "wish-overlay";
    overlay.className = "wish-overlay";
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="wish-panel" role="dialog" aria-modal="true" aria-labelledby="wish-title">' +
      '<div class="wish-panel__top">' +
      '<div>' +
      '<p class="wish-panel__eyebrow">Parents · co-create</p>' +
      '<h2 id="wish-title" class="wish-panel__title">Make a wish</h2>' +
      "</div>" +
      '<div class="wish-jar" id="wish-jar" title="Novel creations spend a star. Tweaks are free.">' +
      '<span class="wish-jar__label">Wish jar</span>' +
      '<span class="wish-jar__stars" id="wish-jar-stars"></span>' +
      '<span class="wish-jar__count" id="wish-jar-count"></span>' +
      "</div></div>" +
      '<p class="wish-panel__copy">Say it out loud with your kid — then grant it. Tweaks are free; big creations spend a jar star.</p>' +
      '<form class="wish-form" id="wish-form">' +
      '<input id="wish-input" class="wish-input" type="text" maxlength="200" autocomplete="off" placeholder="friendly monster… pink walls…" />' +
      '<div class="wish-chips" id="wish-chips"></div>' +
      '<div class="wish-actions">' +
      '<button type="button" class="wish-btn wish-btn--ghost" id="wish-cancel">Cancel</button>' +
      '<button type="button" class="wish-btn wish-btn--ghost" id="wish-undo" hidden>Undo</button>' +
      '<button type="button" class="wish-btn wish-btn--ghost" id="wish-share" hidden>Copy link</button>' +
      '<button type="submit" class="wish-btn wish-btn--go" id="wish-go">Wish</button>' +
      "</div>" +
      '<p class="wish-note" id="wish-note" hidden></p>' +
      "</form>" +
      '<div class="wish-spell" id="wish-spell" hidden aria-live="polite">' +
      '<div class="wish-spell__burst" aria-hidden="true"></div>' +
      '<p class="wish-spell__text">Granting your wish…</p>' +
      "</div></div>";
    runtime.gameRoot.appendChild(overlay);

    const chipsEl = overlay.querySelector("#wish-chips");
    const form = overlay.querySelector("#wish-form");
    const input = overlay.querySelector("#wish-input");
    const noteEl = overlay.querySelector("#wish-note");
    const cancelBtn = overlay.querySelector("#wish-cancel");
    const goBtn = overlay.querySelector("#wish-go");
    const undoBtn = overlay.querySelector("#wish-undo");
    const shareBtn = overlay.querySelector("#wish-share");
    const jarStarsEl = overlay.querySelector("#wish-jar-stars");
    const jarCountEl = overlay.querySelector("#wish-jar-count");
    const spellEl = overlay.querySelector("#wish-spell");

    CHIPS.forEach((chip) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wish-chip" + (chip.novel ? " wish-chip--novel" : "");
      b.textContent = chip.text;
      if (chip.novel) b.title = "Novel creation · spends a jar star";
      b.addEventListener("click", () => {
        input.value = chip.text;
        input.focus();
      });
      chipsEl.appendChild(b);
    });

    let holdStart = null;
    let holdRaf = null;
    let busy = false;
    let lastShareUrl = "";

    function refreshJar() {
      const n = getCredits();
      jarStarsEl.textContent = jarStars(n);
      jarCountEl.textContent = n === 1 ? "1 left" : n + " left";
      const jarEl = overlay.querySelector("#wish-jar");
      if (jarEl) jarEl.classList.toggle("wish-jar--empty", n <= 0);
    }

    function refreshUndo() {
      undoBtn.hidden = history.length === 0;
    }

    function setSpell(on) {
      spellEl.hidden = !on;
      form.classList.toggle("is-casting", on);
    }

    function setOpen(open) {
      overlay.hidden = !open;
      runtime.gameRoot.classList.toggle("is-wishing", open);
      if (open) {
        noteEl.hidden = true;
        noteEl.textContent = "";
        input.value = "";
        setSpell(false);
        refreshJar();
        refreshUndo();
        shareBtn.hidden = !lastShareUrl;
        window.setTimeout(() => input.focus(), 30);
      } else {
        cancelHold();
        setSpell(false);
      }
    }

    function cancelHold() {
      holdStart = null;
      if (holdRaf != null) {
        cancelAnimationFrame(holdRaf);
        holdRaf = null;
      }
      wishBtn.classList.remove("is-holding", "is-ready");
    }

    function pushHistory(spec) {
      history.push(deepCopy(spec));
      while (history.length > HISTORY_MAX) history.shift();
      refreshUndo();
    }

    function showNote(text, kind) {
      noteEl.hidden = false;
      noteEl.textContent = text;
      noteEl.classList.toggle("wish-note--ok", kind === "ok");
      noteEl.classList.toggle("wish-note--warn", kind === "warn");
    }

    function showSuggestions(list) {
      if (!list || !list.length) return;
      chipsEl.querySelectorAll(".wish-chip--suggest").forEach((el) => el.remove());
      list.slice(0, 4).forEach((text) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "wish-chip wish-chip--suggest";
        b.textContent = text;
        b.addEventListener("click", () => {
          input.value = text;
          input.focus();
        });
        chipsEl.appendChild(b);
      });
    }

    const begin = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.pointerId != null && wishBtn.setPointerCapture) {
        try {
          wishBtn.setPointerCapture(e.pointerId);
        } catch (_) {
          /* ignore */
        }
      }
      if (holdStart != null) return;
      holdStart = performance.now();
      wishBtn.classList.add("is-holding");
      const tick = () => {
        if (holdStart == null) return;
        const t = (performance.now() - holdStart) / WISH_HOLD_MS;
        if (t >= 1) {
          holdStart = null;
          holdRaf = null;
          wishBtn.classList.remove("is-holding");
          wishBtn.classList.add("is-ready");
          setOpen(true);
          window.setTimeout(() => wishBtn.classList.remove("is-ready"), 400);
          return;
        }
        holdRaf = requestAnimationFrame(tick);
      };
      holdRaf = requestAnimationFrame(tick);
    };

    const end = (e) => {
      e.stopPropagation();
      cancelHold();
    };

    wishBtn.addEventListener("pointerdown", begin);
    wishBtn.addEventListener("pointerup", end);
    wishBtn.addEventListener("pointercancel", end);
    wishBtn.addEventListener("lostpointercapture", end);

    cancelBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setOpen(false);
    });

    undoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!history.length || busy) return;
      const prev = history.pop();
      runtime.applySpec(prev);
      persist(prev);
      lastShareUrl = shareUrlFor(prev);
      shareBtn.hidden = false;
      refreshUndo();
      showNote("Undid the last wish.", "ok");
      if (global.MashSounds) MashSounds.playFeedback("pop");
    });

    shareBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const url = lastShareUrl || shareUrlFor(runtime.spec);
      lastShareUrl = url;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          const ta = document.createElement("textarea");
          ta.value = url;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        showNote("Link copied — share what you made!", "ok");
      } catch (_) {
        showNote("Copy failed — select and copy from the address bar after wishing.", "warn");
      }
    });

    overlay.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (e.target === overlay && !busy) setOpen(false);
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = input.value.trim();
      if (!text || busy) return;
      busy = true;
      goBtn.disabled = true;
      setSpell(true);
      showNote("", "ok");
      noteEl.hidden = true;

      const spellMin = new Promise((r) => window.setTimeout(r, 720));

      try {
        const resultPromise = requestWish(runtime.spec, text);
        const result = await resultPromise;
        await spellMin;

        if (result.intent === "none") {
          setSpell(false);
          showNote(result.note, "warn");
          showSuggestions(result.suggestions || SUGGEST_FREE);
          return;
        }

        if (result.novel) {
          if (getCredits() < NOVEL_COST) {
            setSpell(false);
            showNote("Wish jar is empty — free tweaks still work. (Credit packs later.)", "warn");
            showSuggestions(SUGGEST_FREE);
            refreshJar();
            return;
          }
        }

        pushHistory(runtime.spec);
        if (result.novel) spendCredit();
        runtime.applySpec(result.spec);
        persist(result.spec);
        lastShareUrl = shareUrlFor(result.spec);
        try {
          const u = new URL(window.location.href);
          u.searchParams.set("wish", encodeWishSpec(result.spec));
          window.history.replaceState({}, "", u.toString());
        } catch (_) {
          /* ignore */
        }
        shareBtn.hidden = false;
        refreshJar();
        setSpell(false);
        const spent = result.novel ? " · spent 1 ★" : " · free tweak";
        showNote((result.note || "Your wish came true!") + spent, "ok");
        if (global.MashSounds) MashSounds.playFeedback("pop");
        window.setTimeout(() => setOpen(false), 900);
      } catch (_) {
        setSpell(false);
        showNote("Wish fizzled. Try again in a moment.", "warn");
      } finally {
        busy = false;
        goBtn.disabled = false;
      }
    });

    const onKey = (e) => {
      if (overlay.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (!busy) setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);

    refreshJar();

    return {
      open: () => setOpen(true),
      close: () => setOpen(false),
      getCredits,
      setCredits,
      shareUrlFor,
      destroy() {
        window.removeEventListener("keydown", onKey, true);
        cancelHold();
        wishBtn.remove();
        overlay.remove();
        runtime._wishMounted = false;
        runtime.gameRoot.classList.remove("is-wishing");
      },
    };
  }

  global.MashWishes = {
    mount,
    applyOffline,
    requestWish,
    persist,
    loadPersisted,
    encodeWishSpec,
    decodeWishSpec,
    getCredits,
    setCredits,
    SEED_CREDITS,
    CREDITS_KEY,
  };
})(window);

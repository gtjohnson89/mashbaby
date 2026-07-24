/**
 * Kid-friendly in-game customization — corner palettes and mash toggles.
 *
 * Drop into any MashRuntime game via GameSpec.customize, or call directly:
 *   MashCustomize.wallPalette(gameRoot, { onPick: (color) => ... })
 */
(function (global) {
  "use strict";

  /** Bright swatches kids love to mash (matches server/app/catalog.py COLORS). */
  const PALETTES = {
    wall: [
      "#ff9ec5",
      "#c49bff",
      "#7ec8ff",
      "#7bc96f",
      "#ffe066",
      "#ff9a5a",
      "#fff6e8",
      "#1a1218",
    ],
    floor: ["#f0c98a", "#e8d5b5", "#ffe066", "#ff9ec5", "#c49bff", "#7bc96f", "#fff6e8", "#8b4a1f"],
    sky: ["#7ec8ff", "#9ad4ff", "#c9e9ff", "#c49bff", "#ff9ec5", "#ffe066", "#e8f6ff", "#5ab0ff"],
    grass: ["#6fbf5a", "#7bc96f", "#b8e986", "#ffe066", "#7ec8ff", "#ff9ec5", "#4aa878", "#2a5020"],
    water: ["#4aa8d8", "#2f7fad", "#7ec8ff", "#5ab0ff", "#4aa878", "#c49bff", "#9ad4ff", "#1a4a60"],
  };

  const TARGETS = {
    wall: { keys: ["wallColor"], dotCompanion: true },
    floor: { keys: ["floorColor"] },
    sky: { keys: ["skyTop", "skyBot"] },
    grass: { keys: ["grassColor"] },
    water: { keys: ["waterColor"] },
  };

  const CORNERS = {
    "top-left": { top: "0.75rem", left: "0.75rem", right: "auto", bottom: "auto" },
    "top-right": { top: "0.75rem", right: "0.75rem", left: "auto", bottom: "auto" },
    "bottom-left": { top: "auto", left: "0.75rem", right: "auto", bottom: "3.5rem" },
    "bottom-right": { top: "auto", right: "0.75rem", left: "auto", bottom: "3.5rem" },
  };

  function storageKey(specId) {
    return `mash-customize:${specId || "game"}`;
  }

  function loadPersisted(specId) {
    try {
      const raw = localStorage.getItem(storageKey(specId));
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function savePersisted(specId, theme) {
    try {
      localStorage.setItem(storageKey(specId), JSON.stringify(theme));
    } catch (_) {
      /* quota / private mode */
    }
  }

  function pickDotCompanion(color, fallback) {
    const dots = fallback || ["#ff9ec5", "#c49bff"];
    return [color, dots[1] || "#ffffff"];
  }

  function themePatchForTarget(targetId, color, currentTheme) {
    const meta = TARGETS[targetId];
    if (!meta) return {};
    const patch = {};
    meta.keys.forEach((k) => {
      patch[k] = color;
    });
    if (meta.dotCompanion) {
      patch.wallDotColors = pickDotCompanion(color, currentTheme && currentTheme.wallDotColors);
    }
    return patch;
  }

  function mergeTheme(root, themePatch) {
    if (global.MashScene && typeof MashScene.applyTheme === "function") {
      MashScene.applyTheme(root, themePatch);
    } else {
      Object.entries(themePatch).forEach(([k, v]) => {
        if (k === "wallDotColors" && Array.isArray(v)) {
          root.style.setProperty("--wall-dot-a", v[0]);
          root.style.setProperty("--wall-dot-b", v[1] || v[0]);
          return;
        }
        const map = {
          wallColor: "--wall-color",
          floorColor: "--floor-color",
          skyTop: "--sky-top",
          skyBot: "--sky-bot",
          grassColor: "--grass-color",
          waterColor: "--water-color",
        };
        if (map[k]) root.style.setProperty(map[k], v);
      });
    }
  }

  function playPickSound() {
    if (global.MashSounds && typeof MashSounds.play === "function") {
      try {
        MashSounds.play("keyPop");
      } catch (_) {
        /* ignore */
      }
    }
  }

  /**
   * Corner color palette for one theme target (wall, sky, floor, …).
   * @returns {{ el: HTMLElement, destroy: Function, setActive: Function }}
   */
  function createColorPalette(options) {
    const {
      target = "wall",
      colors = PALETTES[target] || PALETTES.wall,
      corner = "top-right",
      activeColor = null,
      onPick,
    } = options;

    const pos = CORNERS[corner] || CORNERS["top-right"];
    const wrap = document.createElement("div");
    wrap.className = "kid-palette";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", `${target} colors`);
    Object.assign(wrap.style, pos);

    const grid = document.createElement("div");
    grid.className = "kid-palette__grid";

    let selected = activeColor;

    colors.forEach((color) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "kid-palette__swatch";
      btn.style.setProperty("--swatch-color", color);
      btn.title = color;
      btn.setAttribute("aria-label", `Set ${target} to ${color}`);
      if (color === selected) btn.classList.add("is-active");

      btn.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
      });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        selected = color;
        grid.querySelectorAll(".kid-palette__swatch").forEach((el) => {
          el.classList.toggle("is-active", el === btn);
        });
        playPickSound();
        if (typeof onPick === "function") onPick(color, target);
      });

      grid.appendChild(btn);
    });

    wrap.appendChild(grid);

    return {
      el: wrap,
      setActive(color) {
        selected = color;
        grid.querySelectorAll(".kid-palette__swatch").forEach((btn) => {
          const match = btn.style.getPropertyValue("--swatch-color") === color;
          btn.classList.toggle("is-active", match);
        });
      },
      destroy() {
        wrap.remove();
      },
    };
  }

  /**
   * Mash button that cycles through theme presets (sparkle dots, etc.).
   */
  function createCycleToggle(options) {
    const { label = "✨", corner = "top-right", options: presets = [], themeKeys = [], onCycle } = options;
    const pos = CORNERS[corner] || CORNERS["top-right"];
    let index = 0;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kid-toggle";
    btn.textContent = label;
    btn.setAttribute("aria-label", label);
    Object.assign(btn.style, pos);

    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!presets.length) return;
      index = (index + 1) % presets.length;
      playPickSound();
      btn.classList.add("is-mashed");
      window.setTimeout(() => btn.classList.remove("is-mashed"), 180);
      const value = presets[index];
      const patch = {};
      themeKeys.forEach((k, i) => {
        patch[k] = Array.isArray(value) ? value[i] ?? value[0] : value;
      });
      if (typeof onCycle === "function") onCycle(patch, index);
    });

    return {
      el: btn,
      destroy() {
        btn.remove();
      },
    };
  }

  function normalizeCustomizeConfig(spec) {
    const raw = spec.customize;
    if (!raw) return null;
    if (raw === true) return { palettes: ["wall"], persist: true };
    const out = {
      persist: raw.persist !== false,
      palettes: [],
      toggles: [],
      corners: {},
    };

    if (raw.wallPalette) out.palettes.push("wall");
    if (raw.floorPalette) out.palettes.push("floor");
    if (raw.skyPalette) out.palettes.push("sky");
    if (raw.grassPalette) out.palettes.push("grass");
    if (raw.waterPalette) out.palettes.push("water");

    if (Array.isArray(raw.palettes)) {
      raw.palettes.forEach((p) => {
        if (typeof p === "string") out.palettes.push(p);
        else if (p && p.target) out.palettes.push(p);
      });
    }

    if (Array.isArray(raw.toggles)) out.toggles = raw.toggles;

    if (raw.corner) {
      out.cornerDefault = raw.corner;
    }

    out.palettes = [...new Set(out.palettes)];
    if (!out.palettes.length && !out.toggles.length) return null;
    return out;
  }

  function cornerForTarget(config, targetId, index) {
    if (config.corners && config.corners[targetId]) return config.corners[targetId];
    if (config.cornerDefault) return config.cornerDefault;
    // Stack multiple palettes: first top-right, second top-left
    return index === 0 ? "top-right" : "top-left";
  }

  /**
   * Mount all customize controls from a GameSpec onto the game root.
   * @returns {{ destroy: Function, applyPersistedTheme: Function }}
   */
  function mount(gameRoot, spec, callbacks) {
    const config = normalizeCustomizeConfig(spec);
    if (!config) return { destroy() {}, applyPersistedTheme() {} };

    const onThemeChange = (callbacks && callbacks.onThemeChange) || null;
    const themeRoot = (callbacks && callbacks.themeRoot) || gameRoot;
    const specId = spec.id || "game";
    const widgets = [];
    let theme = Object.assign({}, spec.theme || {});

    function emitTheme(patch) {
      theme = Object.assign({}, theme, patch);
      mergeTheme(themeRoot, patch);
      if (config.persist) savePersisted(specId, theme);
      if (typeof onThemeChange === "function") onThemeChange(theme, patch);
    }

    function applyPersistedTheme() {
      if (!config.persist) return;
      const saved = loadPersisted(specId);
      if (!saved) return;
      theme = Object.assign({}, theme, saved);
      mergeTheme(themeRoot, saved);
      widgets.forEach((w) => {
        if (w.setActive && saved[w.targetKey]) w.setActive(saved[w.targetKey]);
      });
      if (typeof onThemeChange === "function") onThemeChange(theme, saved);
    }

    config.palettes.forEach((entry, index) => {
      const targetId = typeof entry === "string" ? entry : entry.target;
      const meta = TARGETS[targetId];
      if (!meta) return;

      const colors =
        (typeof entry === "object" && entry.colors) || PALETTES[targetId] || PALETTES.wall;
      const corner =
        (typeof entry === "object" && entry.corner) || cornerForTarget(config, targetId, index);
      const activeKey = meta.keys[0];
      const activeColor = theme[activeKey] || null;

      const palette = createColorPalette({
        target: targetId,
        colors,
        corner,
        activeColor,
        onPick(color) {
          const patch = themePatchForTarget(targetId, color, theme);
          emitTheme(patch);
        },
      });

      palette.targetKey = activeKey;
      gameRoot.appendChild(palette.el);
      widgets.push(palette);
    });

    config.toggles.forEach((toggle, index) => {
      const corner = toggle.corner || cornerForTarget(config, toggle.id || "toggle", index + 2);
      const widget = createCycleToggle({
        label: toggle.label || "✨",
        corner,
        options: toggle.options || [],
        themeKeys: toggle.themeKeys || ["wallDotColors"],
        onCycle(patch) {
          emitTheme(patch);
        },
      });
      gameRoot.appendChild(widget.el);
      widgets.push(widget);
    });

    return {
      applyPersistedTheme,
      destroy() {
        widgets.forEach((w) => w.destroy());
      },
    };
  }

  /** Shorthand: wall color palette in the top-right corner. */
  function wallPalette(gameRoot, options) {
    const widget = createColorPalette(
      Object.assign({ target: "wall", corner: "top-right" }, options)
    );
    gameRoot.appendChild(widget.el);
    return widget;
  }

  global.MashCustomize = {
    PALETTES,
    TARGETS,
    mount,
    wallPalette,
    createColorPalette,
    createCycleToggle,
    loadPersisted,
    savePersisted,
    mergeTheme,
    themePatchForTarget,
  };
})(window);

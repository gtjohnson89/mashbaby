/**
 * Scene shell renderers for template ids.
 */
(function (global) {
  "use strict";

  function applyTheme(root, theme) {
    if (!theme) return;
    const s = root.style;
    const map = {
      wallColor: "--wall-color",
      floorColor: "--floor-color",
      floorLine: "--floor-line",
      skyTop: "--sky-top",
      skyBot: "--sky-bot",
      grassColor: "--grass-color",
      waterColor: "--water-color",
      waterDeep: "--water-deep",
      accent: "--accent",
      gateBtnFrom: "--gate-from",
      gateBtnTo: "--gate-to",
    };
    Object.keys(map).forEach((k) => {
      if (theme[k]) s.setProperty(map[k], theme[k]);
    });
    if (theme.wallDotColors && theme.wallDotColors.length) {
      s.setProperty("--wall-dot-a", theme.wallDotColors[0]);
      s.setProperty("--wall-dot-b", theme.wallDotColors[1] || theme.wallDotColors[0]);
    }
  }

  function kitchen(theme) {
    return `
      <div class="walls" aria-hidden="true"></div>
      <div class="kitchen" aria-hidden="true">
        <div class="shelf"></div>
        <div class="oven">
          <div class="oven__window"></div>
          <div class="oven__knob oven__knob--l"></div>
          <div class="oven__knob oven__knob--r"></div>
          <div class="oven__handle"></div>
        </div>
        <div class="freezer">
          <div class="freezer__door"></div>
          <div class="freezer__handle"></div>
          <div class="freezer__label">ICE</div>
        </div>
        <div class="floor"></div>
        <div class="pan" data-spawn-zone="pan"></div>
      </div>`;
  }

  function sky(theme) {
    return `
      <div class="sky-scene" aria-hidden="true">
        <div class="sun"></div>
        <div class="cloud cloud--1"></div>
        <div class="cloud cloud--2"></div>
        <div class="cloud cloud--3"></div>
        <div class="grass"></div>
        <div class="spawn-pad" data-spawn-zone="pad"></div>
      </div>`;
  }

  function pond(theme) {
    return `
      <div class="pond-scene" aria-hidden="true">
        <div class="sky-pond">
          <div class="sun"></div>
          <div class="cloud cloud--1"></div>
          <div class="cloud cloud--2"></div>
        </div>
        <div class="bank bank--back"></div>
        <div class="pond" data-spawn-zone="pond">
          <div class="lily lily--1"></div>
          <div class="lily lily--2"></div>
          <div class="lily lily--3"></div>
          <div class="reed reed--1"></div>
          <div class="reed reed--2"></div>
        </div>
        <div class="bank bank--front"></div>
      </div>`;
  }

  function blank(theme) {
    return `
      <div class="blank-scene" aria-hidden="true">
        <div class="blank-walls"></div>
        <div class="blank-floor"></div>
        <div class="spawn-pad" data-spawn-zone="pad"></div>
      </div>`;
  }

  function pantry(theme) {
    const ice = (a, b, c) => {
      const scoops = c
        ? `<circle cx="16" cy="28" r="9" fill="${a}"/>
           <circle cx="24" cy="24" r="8" fill="${b}"/>
           <circle cx="20" cy="14" r="8" fill="${c}"/>`
        : `<circle cx="18" cy="28" r="9" fill="${a}"/>
           <circle cx="22" cy="18" r="9" fill="${b}"/>`;
      return `<svg class="shelf-ice__svg" viewBox="0 0 40 52" aria-hidden="true">
        <path d="M12 32 L20 50 L28 32 Z" fill="#f2c78a"/>
        ${scoops}
      </svg>`;
    };
    return `
      <div class="pantry-scene" aria-hidden="true">
        <div class="pantry-walls"></div>
        <div class="pantry-shelf pantry-shelf--top"></div>
        <div class="pantry-shelf-ice pantry-shelf-ice--top">
          <div class="shelf-ice">${ice("#ff9ec5", "#c49bff", "#fff6e0")}</div>
          <div class="shelf-ice">${ice("#a8e6ff", "#5ab0ff", "")}</div>
          <div class="shelf-ice">${ice("#b8e986", "#ffe066", "#ff9ec5")}</div>
          <div class="shelf-ice">${ice("#c49bff", "#ff8fab", "")}</div>
        </div>
        <div class="pantry-shelf pantry-shelf--mid"></div>
        <div class="pantry-shelf-ice pantry-shelf-ice--mid">
          <div class="shelf-ice shelf-ice--sm">${ice("#ffe066", "#ff9a5a", "")}</div>
          <div class="shelf-ice shelf-ice--sm">${ice("#ff9ec5", "#fff0f6", "#c49bff")}</div>
          <div class="shelf-ice shelf-ice--sm">${ice("#7ec8ff", "#d4a5ff", "")}</div>
        </div>
        <div class="cheese-wheel"></div>
        <div class="mouse-hole mouse-hole--l"></div>
        <div class="mouse-hole mouse-hole--r"></div>
        <div class="pantry-floor" data-spawn-zone="floor"></div>
      </div>`;
  }

  function trashcanAlley(theme) {
    return `
      <div class="alley-scene" aria-hidden="true">
        <div class="alley-sky"></div>
        <div class="alley-bricks"></div>
        <div class="alley-window alley-window--l"></div>
        <div class="alley-window alley-window--r"></div>
        <div class="alley-sidewalk" data-spawn-zone="sidewalk"></div>
        <div class="alley-curb"></div>
        <div class="trash-can" data-actor-home="can">
          <div class="trash-can__shadow"></div>
          <div class="trash-can__lid"></div>
          <div class="trash-can__body">
            <div class="trash-can__ridge"></div>
            <div class="trash-can__ridge trash-can__ridge--2"></div>
            <div class="trash-can__handle"></div>
          </div>
        </div>
        <div class="alley-crumb alley-crumb--1"></div>
        <div class="alley-crumb alley-crumb--2"></div>
        <div class="alley-crumb alley-crumb--3"></div>
      </div>`;
  }

  const TEMPLATES = {
    "kitchen-mash": kitchen,
    "sky-pop": sky,
    "pond-splash": pond,
    "blank-room": blank,
    "pantry-nibble": pantry,
    "trashcan-alley": trashcanAlley,
  };

  function render(container, spec) {
    const theme = spec.theme || {};
    applyTheme(container, theme);
    const template = (spec.scene && spec.scene.template) || "blank-room";
    const fn = TEMPLATES[template] || blank;
    container.innerHTML = fn(theme) + `<div id="stage" class="stage" aria-live="polite"></div>`;
    return {
      stage: container.querySelector("#stage"),
      spawnZone: container.querySelector("[data-spawn-zone]"),
      template,
    };
  }

  global.MashScene = { render, applyTheme, TEMPLATES };
})(window);

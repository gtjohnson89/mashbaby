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

  const TEMPLATES = {
    "kitchen-mash": kitchen,
    "sky-pop": sky,
    "pond-splash": pond,
    "blank-room": blank,
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

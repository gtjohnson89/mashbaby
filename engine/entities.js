/**
 * Catalog SVG builders + look tables for known entity kinds.
 */
(function (global) {
  "use strict";

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  const BABY_LOOKS = [
    { skin: "#f7c9a8", onesie: "#ff8fab", cheeks: "#ff9aa8", hair: "#5a3a22" },
    { skin: "#e8b089", onesie: "#7ec8ff", cheeks: "#f08a9a", hair: "#2a1a12" },
    { skin: "#c88a5a", onesie: "#b8e986", cheeks: "#e07888", hair: "#1a1008" },
    { skin: "#f2d2b0", onesie: "#d4a5ff", cheeks: "#ff9eb0", hair: "#8b5a2b" },
    { skin: "#d4a574", onesie: "#ffe066", cheeks: "#f090a0", hair: "#3d2314" },
  ];

  const ICE_FLAVORS = [
    { scoop: "#ff9ec5", scoop2: "#fff0f6", sprinkle: "#c49bff" },
    { scoop: "#c49bff", scoop2: "#f0e6ff", sprinkle: "#ff9ec5" },
    { scoop: "#fff6e0", scoop2: "#ffe4a8", sprinkle: "#7ec8ff" },
    { scoop: "#a8e6ff", scoop2: "#e8f9ff", sprinkle: "#ff8fab" },
    { scoop: "#b8e986", scoop2: "#f0ffe0", sprinkle: "#ff9ec5" },
  ];

  const BALLOON_PALETTES = [
    { body: "#ff6b9d", shine: "#ffd0e0", string: "#c44a72" },
    { body: "#5ab0ff", shine: "#d0ecff", string: "#2a78c4" },
    { body: "#ffe066", shine: "#fff6c8", string: "#d4a020" },
    { body: "#b8e986", shine: "#e8ffd0", string: "#5a9a3a" },
    { body: "#c49bff", shine: "#eee0ff", string: "#7a4ec4" },
    { body: "#ff9a5a", shine: "#ffe0c8", string: "#c45a20" },
  ];

  const DUCK_LOOKS = [
    { body: "#ffe066", wing: "#f0c830", beak: "#ff8a3a", eye: "#2a2a2a" },
    { body: "#fff0c8", wing: "#e8d090", beak: "#ff9a4a", eye: "#2a2a2a" },
    { body: "#ffd24a", wing: "#e0a820", beak: "#ff7040", eye: "#2a2a2a" },
  ];

  const MOUSE_LOOKS = [
    { fur: "#9a8a82", belly: "#c8bcb4", ear: "#ff9ec5", nose: "#ff8fab", eye: "#2a2a2a" },
    { fur: "#7a6a62", belly: "#b0a498", ear: "#c49bff", nose: "#e07888", eye: "#2a2a2a" },
    { fur: "#b8a898", belly: "#e8ddd0", ear: "#7ec8ff", nose: "#ff9aa8", eye: "#2a2a2a" },
  ];

  const DINO_LOOKS = [
    { body: "#7bc96f", belly: "#c8f0a8", spikes: "#4f9a3a", eye: "#2a2a2a" },
    { body: "#c49bff", belly: "#eee0ff", spikes: "#7a4ec4", eye: "#2a2a2a" },
    { body: "#ff9a5a", belly: "#ffe0c8", spikes: "#c45a20", eye: "#2a2a2a" },
  ];

  const PUPPY_LOOKS = [
    { fur: "#e8b089", ear: "#c88a5a", belly: "#fff0e0", eye: "#2a2a2a" },
    { fur: "#8b5a2b", ear: "#5a3a22", belly: "#f2d2b0", eye: "#2a2a2a" },
    { fur: "#fff6e0", ear: "#e8d090", belly: "#ffffff", eye: "#2a2a2a" },
  ];

  const MONSTER_LOOKS = [
    { fur: "#3a8fd4", belly: "#6eb8f0", mouth: "#1a2840", eye: "#2a2a2a" },
    { fur: "#2f7fc4", belly: "#5aa8e8", mouth: "#152030", eye: "#2a2a2a" },
    { fur: "#4a9ae0", belly: "#7ec8ff", mouth: "#1a2840", eye: "#2a2a2a" },
  ];

  function cookieSvg(stageName) {
    const fill = stageName === "ready" ? "#c47a3a" : stageName === "baking" ? "#e8b86a" : "#f3d8a6";
    const rim = stageName === "ready" ? "#a05a28" : stageName === "baking" ? "#d4a05a" : "#e8c98a";
    const chipOp = stageName === "dough" ? 0.35 : 1;
    return `<svg class="ent__svg" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="28" fill="${rim}"/>
      <circle cx="36" cy="36" r="25" fill="${fill}"/>
      <circle cx="22" cy="28" r="3.2" fill="#5a3018" opacity="${chipOp}"/>
      <circle cx="38" cy="22" r="2.8" fill="#4a2814" opacity="${chipOp}"/>
      <circle cx="50" cy="30" r="3" fill="#5a3018" opacity="${chipOp}"/>
      <circle cx="28" cy="42" r="2.6" fill="#4a2814" opacity="${chipOp}"/>
      <circle cx="44" cy="44" r="3.4" fill="#5a3018" opacity="${chipOp}"/>
    </svg>`;
  }

  function iceCreamSvg(flavor) {
    const f = flavor || pick(ICE_FLAVORS);
    return `<svg class="ent__svg" viewBox="0 0 64 84" aria-hidden="true">
      <path d="M20 48 L32 80 L44 48 Z" fill="#f2c78a"/>
      <circle cx="24" cy="38" r="13" fill="${f.scoop}"/>
      <circle cx="40" cy="36" r="12" fill="${f.scoop2}"/>
      <circle cx="32" cy="28" r="13" fill="${f.scoop}"/>
      <circle cx="30" cy="34" r="1.8" fill="${f.sprinkle}"/>
      <circle cx="38" cy="32" r="1.6" fill="${f.sprinkle}"/>
    </svg>`;
  }

  function balloonSvg(palette) {
    const p = palette || pick(BALLOON_PALETTES);
    return `<svg class="ent__svg" viewBox="0 0 90 120" aria-hidden="true">
      <ellipse cx="45" cy="48" rx="32" ry="40" fill="${p.body}"/>
      <ellipse cx="34" cy="36" rx="10" ry="14" fill="${p.shine}" opacity="0.55"/>
      <path d="M40 88 L45 96 L50 88 Z" fill="${p.body}"/>
      <path d="M45 96 C42 104, 48 110, 45 118" fill="none" stroke="${p.string}" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  }

  function duckSvg(look) {
    const l = look || pick(DUCK_LOOKS);
    return `<svg class="ent__svg" viewBox="0 0 110 90" aria-hidden="true">
      <ellipse cx="52" cy="58" rx="34" ry="22" fill="${l.body}"/>
      <ellipse cx="68" cy="52" rx="16" ry="12" fill="${l.wing}"/>
      <circle cx="78" cy="36" r="18" fill="${l.body}"/>
      <circle cx="86" cy="32" r="3.2" fill="${l.eye}"/>
      <path d="M94 36 L108 34 L94 42 Z" fill="${l.beak}"/>
    </svg>`;
  }

  function mouseSvg(look) {
    const l = look || pick(MOUSE_LOOKS);
    return `<svg class="ent__svg" viewBox="0 0 100 72" aria-hidden="true">
      <ellipse cx="38" cy="48" rx="22" ry="16" fill="${l.belly}"/>
      <ellipse cx="42" cy="44" rx="26" ry="18" fill="${l.fur}"/>
      <circle cx="68" cy="38" r="16" fill="${l.fur}"/>
      <circle cx="74" cy="34" r="2.8" fill="${l.eye}"/>
      <circle cx="75" cy="33" r="1" fill="#fff"/>
      <circle cx="82" cy="40" r="4" fill="${l.nose}"/>
      <path d="M86 38 L94 36 L86 42 Z" fill="${l.nose}"/>
      <ellipse cx="58" cy="22" rx="10" ry="14" fill="${l.ear}" transform="rotate(-12 58 22)"/>
      <ellipse cx="76" cy="20" rx="10" ry="14" fill="${l.ear}" transform="rotate(12 76 20)"/>
      <path d="M18 44 Q8 36 14 28" fill="none" stroke="${l.fur}" stroke-width="5" stroke-linecap="round"/>
    </svg>`;
  }

  function ballSvg() {
    const c = pick(["#ff6b9d", "#5ab0ff", "#ffe066", "#b8e986", "#c49bff"]);
    return `<svg class="ent__svg" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="26" fill="${c}"/>
      <ellipse cx="24" cy="22" rx="8" ry="6" fill="#fff" opacity="0.45"/>
      <path d="M10 32 Q32 20 54 32" fill="none" stroke="#fff" stroke-width="2" opacity="0.35"/>
    </svg>`;
  }

  function starSvg() {
    return `<svg class="ent__svg" viewBox="0 0 64 64" aria-hidden="true">
      <polygon points="32,4 39,24 60,24 43,38 50,58 32,46 14,58 21,38 4,24 25,24" fill="#ffe066"/>
      <circle cx="32" cy="30" r="6" fill="#fff6c8" opacity="0.5"/>
    </svg>`;
  }

  function babySvg(look) {
    const l = look || pick(BABY_LOOKS);
    return `<svg class="ent__svg" viewBox="0 0 130 110" aria-hidden="true">
      <ellipse cx="68" cy="72" rx="34" ry="26" fill="${l.onesie}"/>
      <circle cx="48" cy="42" r="28" fill="${l.skin}"/>
      <path d="M30 30c4-14 22-18 34-8 2 1-2 4-6 5-8-6-18-4-24 2z" fill="${l.hair}"/>
      <circle cx="34" cy="50" r="7" fill="${l.cheeks}" opacity="0.7"/>
      <circle cx="62" cy="50" r="7" fill="${l.cheeks}" opacity="0.7"/>
      <path d="M34 40c2 4 8 4 10 0" fill="none" stroke="#3a2a1a" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M50 40c2 4 8 4 10 0" fill="none" stroke="#3a2a1a" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M40 52c3 6 13 6 16 0" fill="none" stroke="#c45a6a" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="58" cy="94" rx="11" ry="8" fill="${l.skin}"/>
      <ellipse cx="82" cy="92" rx="11" ry="8" fill="${l.skin}"/>
    </svg>`;
  }

  function dinoSvg(look) {
    const l = look || pick(DINO_LOOKS);
    return `<svg class="ent__svg" viewBox="0 0 140 110" aria-hidden="true">
      <ellipse cx="70" cy="70" rx="40" ry="28" fill="${l.body}"/>
      <ellipse cx="70" cy="74" rx="28" ry="16" fill="${l.belly}"/>
      <circle cx="105" cy="48" r="22" fill="${l.body}"/>
      <circle cx="112" cy="44" r="3.5" fill="${l.eye}"/>
      <circle cx="113" cy="43" r="1.2" fill="#fff"/>
      <path d="M118 52 L138 50 L118 60 Z" fill="${l.body}"/>
      <path d="M55 42 L62 22 L70 42 L78 20 L85 42" fill="${l.spikes}"/>
      <ellipse cx="45" cy="92" rx="12" ry="8" fill="${l.body}"/>
      <ellipse cx="85" cy="92" rx="12" ry="8" fill="${l.body}"/>
      <path d="M30 70 Q10 60 18 80" fill="none" stroke="${l.body}" stroke-width="10" stroke-linecap="round"/>
    </svg>`;
  }

  function puppySvg(look) {
    const l = look || pick(PUPPY_LOOKS);
    return `<svg class="ent__svg" viewBox="0 0 120 100" aria-hidden="true">
      <ellipse cx="58" cy="62" rx="32" ry="24" fill="${l.fur}"/>
      <ellipse cx="58" cy="68" rx="20" ry="12" fill="${l.belly}"/>
      <circle cx="88" cy="42" r="20" fill="${l.fur}"/>
      <ellipse cx="72" cy="30" rx="8" ry="14" fill="${l.ear}" transform="rotate(-20 72 30)"/>
      <ellipse cx="100" cy="30" rx="8" ry="14" fill="${l.ear}" transform="rotate(20 100 30)"/>
      <circle cx="94" cy="40" r="3" fill="${l.eye}"/>
      <ellipse cx="102" cy="48" rx="5" ry="3.5" fill="#ff9aa8"/>
      <ellipse cx="40" cy="82" rx="10" ry="7" fill="${l.fur}"/>
      <ellipse cx="70" cy="84" rx="10" ry="7" fill="${l.fur}"/>
    </svg>`;
  }

  function monsterSvg(look) {
    const l = look || pick(MONSTER_LOOKS);
    return `<svg class="ent__svg" viewBox="0 0 140 120" aria-hidden="true">
      <ellipse cx="70" cy="72" rx="48" ry="36" fill="${l.fur}"/>
      <ellipse cx="70" cy="80" rx="30" ry="20" fill="${l.belly}"/>
      <circle cx="70" cy="48" r="38" fill="${l.fur}"/>
      <circle cx="52" cy="40" r="14" fill="#fff"/>
      <circle cx="88" cy="38" r="16" fill="#fff"/>
      <circle cx="54" cy="42" r="6" fill="${l.eye}"/>
      <circle cx="90" cy="40" r="7" fill="${l.eye}"/>
      <circle cx="56" cy="40" r="2" fill="#fff"/>
      <circle cx="92" cy="38" r="2.2" fill="#fff"/>
      <ellipse cx="70" cy="62" rx="22" ry="16" fill="${l.mouth}"/>
      <ellipse cx="70" cy="58" rx="18" ry="4" fill="#c45a6a" opacity="0.35"/>
      <ellipse cx="48" cy="98" rx="12" ry="10" fill="${l.fur}"/>
      <ellipse cx="92" cy="98" rx="12" ry="10" fill="${l.fur}"/>
      <circle cx="28" cy="70" r="10" fill="${l.fur}"/>
      <circle cx="112" cy="68" r="10" fill="${l.fur}"/>
      <circle cx="100" cy="78" r="6" fill="#e8b86a"/>
      <circle cx="98" cy="76" r="1.4" fill="#5a3018"/>
      <circle cx="103" cy="80" r="1.2" fill="#5a3018"/>
    </svg>`;
  }

  function birdSvg() {
    const c = pick(["#5ab0ff", "#ff6b9d", "#ffe066", "#c49bff"]);
    return `<svg class="ent__svg" viewBox="0 0 48 32" aria-hidden="true">
      <ellipse cx="24" cy="18" rx="14" ry="8" fill="${c}"/>
      <circle cx="36" cy="14" r="6" fill="${c}"/>
      <circle cx="38" cy="13" r="1.5" fill="#2a2a2a"/>
      <path d="M40 14 L46 13 L40 17 Z" fill="#ff8a3a"/>
      <path d="M10 18 Q2 8 14 14" fill="${c}"/>
      <path d="M10 18 Q4 26 14 20" fill="${c}" opacity="0.8"/>
    </svg>`;
  }

  const META = {
    cookie: { role: "spawn", behavior: "bake_ready", width: 72, height: 72, soundSpawn: "cookieDrop", soundReady: "ovenDing", soundInteract: "munch" },
    icecream: { role: "spawn", behavior: "drop_ready", width: 64, height: 84, soundSpawn: "iceCreamDrop", soundInteract: "lick" },
    balloon: { role: "spawn", behavior: "float_pop", width: 90, height: 120, soundSpawn: "inflate", soundReady: "float", soundInteract: "pop" },
    duck: { role: "spawn", behavior: "splash_swim", width: 110, height: 90, soundSpawn: "splash", soundInteract: "quack" },
    mouse: { role: "spawn", behavior: "scurry_nibble", width: 100, height: 72, soundSpawn: "squeak", soundInteract: "munch" },
    ball: { role: "spawn", behavior: "drop_ready", width: 64, height: 64, soundSpawn: "cookieDrop", soundInteract: "munch" },
    star: { role: "spawn", behavior: "drop_ready", width: 64, height: 64, soundSpawn: "float", soundInteract: "chirp" },
    baby: { role: "actor", behavior: "seek_and_munch", width: 130, height: 110, soundArrive: "babyArrive", soundInteract: "munch" },
    dino: { role: "actor", behavior: "seek_and_munch", width: 140, height: 110, soundArrive: "roar", soundInteract: "munch" },
    puppy: { role: "actor", behavior: "seek_and_munch", width: 120, height: 100, soundArrive: "babyArrive", soundInteract: "munch" },
    monster: { role: "actor", behavior: "pop_from_can", width: 140, height: 120, soundArrive: "omNom", soundInteract: "munch" },
    birds: { role: "ambient", behavior: "fly_across", width: 48, height: 32, soundSpawn: "chirp" },
    clouds: { role: "ambient", behavior: "drift", width: 80, height: 30 },
    bubbles: { role: "ambient", behavior: "rise", width: 24, height: 24 },
    sparkles: { role: "ambient", behavior: "twinkle", width: 12, height: 12 },
  };

  function render(kind, opts) {
    opts = opts || {};
    switch (kind) {
      case "cookie":
        return cookieSvg(opts.stage || "dough");
      case "icecream":
        return iceCreamSvg(opts.flavor);
      case "balloon":
        return balloonSvg(opts.palette);
      case "duck":
        return duckSvg(opts.look);
      case "mouse":
        return mouseSvg(opts.look);
      case "ball":
        return ballSvg();
      case "star":
        return starSvg();
      case "baby":
        return babySvg(opts.look);
      case "dino":
        return dinoSvg(opts.look);
      case "puppy":
        return puppySvg(opts.look);
      case "monster":
        return monsterSvg(opts.look);
      case "birds":
      case "bird":
        return birdSvg();
      default:
        return null;
    }
  }

  function meta(kind, customEntities) {
    if (META[kind]) return { ...META[kind], kind };
    const custom = customEntities && customEntities[kind];
    if (custom) {
      return {
        kind,
        role: custom.role || "spawn",
        behavior: custom.behavior || "drop_ready",
        width: custom.width || 72,
        height: custom.height || 72,
        soundSpawn: custom.soundSpawn,
        soundReady: custom.soundReady,
        soundInteract: custom.soundInteract || "munch",
        soundArrive: custom.soundArrive,
        parts: custom.parts,
        svg: custom.svg,
      };
    }
    return null;
  }

  global.MashEntities = {
    render,
    meta,
    META,
    pick,
    BABY_LOOKS,
    ICE_FLAVORS,
    BALLOON_PALETTES,
    DUCK_LOOKS,
    MOUSE_LOOKS,
    DINO_LOOKS,
    PUPPY_LOOKS,
    MONSTER_LOOKS,
  };
})(window);

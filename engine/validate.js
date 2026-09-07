/**
 * GameSpec validation + sanitize. Never leave a toddler on a dead/error screen.
 */
(function (global) {
  "use strict";

  const DEFAULT_SESSION_MINUTES = 10;

  /** Bundled playable fallback when fetch/spec fails. */
  const FALLBACK_SPEC = {
    id: "babies-eating-cookies",
    title: "Babies Eating Cookies",
    brand: "mashbaby",
    copy: "Mash any key for cookies and ice cream!",
    theme: {
      wallColor: "#1a1218",
      wallDotColors: ["#ff9ec5", "#c49bff"],
      floorColor: "#f0c98a",
      floorLine: "#e0b56e",
      accent: "#d45a7a",
      gateBtnFrom: "#e08940",
      gateBtnTo: "#d45a7a",
    },
    scene: { template: "kitchen-mash", props: {} },
    onMash: [
      { kind: "cookie", weight: 65 },
      { kind: "icecream", weight: 35 },
    ],
    actors: [{ kind: "baby", behavior: "seek_and_munch", max: 8 }],
    ambient: [],
    limits: { maxSpawns: 18, spawnCooldownMs: 90 },
    customEntities: {},
  };

  const KNOWN_TEMPLATES = {
    "kitchen-mash": true,
    "sky-pop": true,
    "pond-splash": true,
    "blank-room": true,
    "pantry-nibble": true,
    "trashcan-alley": true,
  };

  const KNOWN_SPAWN_KINDS = {
    cookie: true,
    icecream: true,
    balloon: true,
    duck: true,
    mouse: true,
    ball: true,
    star: true,
  };

  const KNOWN_ACTOR_KINDS = {
    baby: true,
    dino: true,
    puppy: true,
    monster: true,
  };

  const KNOWN_AMBIENT = {
    birds: true,
    clouds: true,
    bubbles: true,
    sparkles: true,
  };

  const PARTS_BODIES = ["blob", "egg", "round", "tall", "long"];
  const PARTS_EYES = ["big", "sleepy", "googly", "sparkly", "happy"];
  const PARTS_MOUTHS = ["smile", "open-munch", "tiny-o", "grin", "none"];
  const PARTS_EXTRAS = ["horn", "horns", "ears", "wings", "tail", "antennae", "crown", "hat", "spots", "stripes"];
  const PARTS_DEFAULTS = {
    body: "blob",
    eyes: "big",
    mouth: "smile",
    color: "#ff9ec5",
    accent: "#ffe0f0",
  };
  const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
  const SVG_XSS_RE = /<script|<foreignObject|<image|on\w+\s*=|javascript:/i;
  const VALID_ROLES = { spawn: true, actor: true, ambient: true };

  function sanitizeParts(parts) {
    if (!isPlainObject(parts)) return undefined;
    const d = PARTS_DEFAULTS;
    const out = {
      body: typeof parts.body === "string" && PARTS_BODIES.indexOf(parts.body) >= 0 ? parts.body : d.body,
      eyes: typeof parts.eyes === "string" && PARTS_EYES.indexOf(parts.eyes) >= 0 ? parts.eyes : d.eyes,
      mouth: typeof parts.mouth === "string" && PARTS_MOUTHS.indexOf(parts.mouth) >= 0 ? parts.mouth : d.mouth,
      color: typeof parts.color === "string" && HEX_RE.test(parts.color) ? parts.color : d.color,
      accent: typeof parts.accent === "string" && HEX_RE.test(parts.accent) ? parts.accent : d.accent,
    };
    let extras = Array.isArray(parts.extras)
      ? parts.extras.filter((e) => typeof e === "string" && PARTS_EXTRAS.indexOf(e) >= 0)
      : [];
    extras = extras.slice(0, 3);
    if (extras.length) out.extras = extras;
    return out;
  }

  function sanitizeCustomEntity(entry) {
    if (!isPlainObject(entry)) return null;
    const out = {};
    out.role = VALID_ROLES[entry.role] ? entry.role : "spawn";
    const w = typeof entry.width === "number" && Number.isFinite(entry.width) ? Math.min(240, Math.max(16, entry.width)) : 72;
    const h = typeof entry.height === "number" && Number.isFinite(entry.height) ? Math.min(240, Math.max(16, entry.height)) : 72;
    out.width = w;
    out.height = h;
    if (typeof entry.behavior === "string" && entry.behavior) out.behavior = entry.behavior;
    const parts = sanitizeParts(entry.parts);
    if (parts) out.parts = parts;
    if (typeof entry.svg === "string" && !SVG_XSS_RE.test(entry.svg)) out.svg = entry.svg;
    if (typeof entry.soundSpawn === "string") out.soundSpawn = entry.soundSpawn;
    if (typeof entry.soundReady === "string") out.soundReady = entry.soundReady;
    if (typeof entry.soundInteract === "string") out.soundInteract = entry.soundInteract;
    if (typeof entry.soundArrive === "string") out.soundArrive = entry.soundArrive;
    return out;
  }

  function sanitizeCustomEntities(raw) {
    if (!isPlainObject(raw)) return {};
    const out = {};
    Object.keys(raw).forEach((key) => {
      const cleaned = sanitizeCustomEntity(raw[key]);
      if (cleaned) out[key] = cleaned;
    });
    return out;
  }

  function isPlainObject(v) {
    return v != null && typeof v === "object" && !Array.isArray(v);
  }

  function kindResolvable(kind, customEntities) {
    if (!kind || typeof kind !== "string") return false;
    if (KNOWN_SPAWN_KINDS[kind] || KNOWN_ACTOR_KINDS[kind] || KNOWN_AMBIENT[kind]) return true;
    return !!(customEntities && customEntities[kind] && isPlainObject(customEntities[kind]));
  }

  /**
   * Returns a playable spec. Never throws. Unknown mash kinds / bad refs are dropped
   * or remapped so taps always do something.
   */
  function sanitize(raw) {
    if (!isPlainObject(raw)) {
      return Object.assign({}, FALLBACK_SPEC, { _fallbackReason: "invalid-spec" });
    }

    const customEntities = sanitizeCustomEntities(isPlainObject(raw.customEntities) ? raw.customEntities : {});
    const theme = isPlainObject(raw.theme) ? raw.theme : {};
    const limitsIn = isPlainObject(raw.limits) ? raw.limits : {};

    let template =
      raw.scene && typeof raw.scene.template === "string" ? raw.scene.template : "blank-room";
    if (!KNOWN_TEMPLATES[template]) template = "blank-room";

    let onMash = Array.isArray(raw.onMash) ? raw.onMash : [];
    onMash = onMash
      .filter((item) => item && kindResolvable(item.kind, customEntities))
      .map((item) => {
        const mapped = {
          kind: item.kind,
          weight: typeof item.weight === "number" && item.weight > 0 ? item.weight : 1,
        };
        if (typeof item.behavior === "string" && item.behavior) {
          mapped.behavior = item.behavior;
        }
        return mapped;
      });
    if (!onMash.length) {
      onMash = [{ kind: "star", weight: 1 }, { kind: "ball", weight: 1 }];
    }

    let actors = Array.isArray(raw.actors) ? raw.actors : [];
    actors = actors
      .filter((a) => a && kindResolvable(a.kind, customEntities))
      .map((a) => ({
        kind: a.kind,
        behavior: a.behavior || "seek_and_munch",
        max: typeof a.max === "number" && a.max > 0 ? a.max : 8,
      }));

    let ambient = Array.isArray(raw.ambient) ? raw.ambient : [];
    ambient = ambient
      .filter((a) => a && kindResolvable(a.kind, customEntities))
      .map((a) => ({
        kind: a.kind,
        count: typeof a.count === "number" && a.count > 0 ? a.count : 3,
      }));

    const maxSpawns =
      typeof limitsIn.maxSpawns === "number" && limitsIn.maxSpawns > 0
        ? Math.min(40, Math.floor(limitsIn.maxSpawns))
        : 18;
    const spawnCooldownMs =
      typeof limitsIn.spawnCooldownMs === "number" && limitsIn.spawnCooldownMs >= 0
        ? Math.min(500, Math.floor(limitsIn.spawnCooldownMs))
        : 90;

    const out = {
      id: typeof raw.id === "string" ? raw.id : "mash-game",
      title: typeof raw.title === "string" ? raw.title : "Mash Game",
      brand: typeof raw.brand === "string" ? raw.brand : "mashbaby",
      copy: typeof raw.copy === "string" ? raw.copy : "Mash anywhere!",
      theme,
      scene: { template, props: (raw.scene && raw.scene.props) || {} },
      onMash,
      actors,
      ambient,
      limits: { maxSpawns, spawnCooldownMs },
      customEntities,
    };

    if (isPlainObject(raw.customize)) out.customize = raw.customize;
    if (isPlainObject(raw.sounds)) out.sounds = raw.sounds;

    if (isPlainObject(raw.parent)) {
      const p = raw.parent;
      let sessionMinutes = DEFAULT_SESSION_MINUTES;
      if (typeof p.sessionMinutes === "number" && Number.isFinite(p.sessionMinutes)) {
        sessionMinutes = Math.max(0, Math.min(60, p.sessionMinutes));
      }
      out.parent = {
        sessionMinutes,
        calmDefault: !!p.calmDefault,
      };
    }

    return out;
  }

  function isUsable(spec) {
    return isPlainObject(spec) && Array.isArray(spec.onMash) && spec.onMash.length > 0;
  }

  global.MashValidate = {
    FALLBACK_SPEC,
    sanitize,
    isUsable,
    kindResolvable,
  };
})(window);

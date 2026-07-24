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
  };

  const KNOWN_SPAWN_KINDS = {
    cookie: true,
    icecream: true,
    balloon: true,
    duck: true,
    ball: true,
    star: true,
  };

  const KNOWN_ACTOR_KINDS = {
    baby: true,
    dino: true,
    puppy: true,
  };

  const KNOWN_AMBIENT = {
    birds: true,
    clouds: true,
    bubbles: true,
    sparkles: true,
  };

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

    const customEntities = isPlainObject(raw.customEntities) ? raw.customEntities : {};
    const theme = isPlainObject(raw.theme) ? raw.theme : {};
    const limitsIn = isPlainObject(raw.limits) ? raw.limits : {};

    let template =
      raw.scene && typeof raw.scene.template === "string" ? raw.scene.template : "blank-room";
    if (!KNOWN_TEMPLATES[template]) template = "blank-room";

    let onMash = Array.isArray(raw.onMash) ? raw.onMash : [];
    onMash = onMash
      .filter((item) => item && kindResolvable(item.kind, customEntities))
      .map((item) => ({
        kind: item.kind,
        weight: typeof item.weight === "number" && item.weight > 0 ? item.weight : 1,
      }));
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

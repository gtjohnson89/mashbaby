(function (global) {
  "use strict";

  var EMBEDDED = {
    version: 1,
    bodies: ["blob", "egg", "round", "tall", "long"],
    eyes: ["big", "sleepy", "googly", "sparkly", "happy"],
    mouths: ["smile", "open-munch", "tiny-o", "grin", "none"],
    extras: ["horn", "horns", "ears", "wings", "tail", "antennae", "crown", "hat", "spots", "stripes"],
    defaults: { body: "blob", eyes: "big", mouth: "smile", color: "#ff9ec5", accent: "#ffe0f0" },
  };

  var vocab = EMBEDDED;
  var DEFAULTS = EMBEDDED.defaults;
  var loaded = false;
  var loadPromise = null;
  var clipSeq = 0;
  var EYE = "#2a2a2a";

  function isEnum(val, list) {
    return typeof val === "string" && list.indexOf(val) >= 0;
  }

  function lighten(hex, amount) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    r = Math.round(r + (255 - r) * amount);
    g = Math.round(g + (255 - g) * amount);
    b = Math.round(b + (255 - b) * amount);
    return (
      "#" +
      r.toString(16).padStart(2, "0") +
      g.toString(16).padStart(2, "0") +
      b.toString(16).padStart(2, "0")
    );
  }

  function normalizeParts(raw) {
    var d = DEFAULTS;
    var p = raw && typeof raw === "object" ? raw : {};
    var color = typeof p.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(p.color) ? p.color : d.color;
    var accent =
      typeof p.accent === "string" && /^#[0-9a-fA-F]{3,8}$/.test(p.accent) ? p.accent : lighten(color, 0.65);
    var extras = Array.isArray(p.extras)
      ? p.extras.filter(function (e) {
          return isEnum(e, vocab.extras);
        }).slice(0, 3)
      : [];
    return {
      body: isEnum(p.body, vocab.bodies) ? p.body : d.body,
      color: color,
      accent: accent,
      eyes: isEnum(p.eyes, vocab.eyes) ? p.eyes : d.eyes,
      mouth: isEnum(p.mouth, vocab.mouths) ? p.mouth : d.mouth,
      extras: extras,
    };
  }

  function bodyPath(body) {
    switch (body) {
      case "egg":
        return "M36 8 C52 8 58 28 58 42 C58 58 48 66 36 66 C24 66 14 58 14 42 C14 28 20 8 36 8Z";
      case "round":
        return "M36 10 C52 10 62 24 62 38 C62 56 50 66 36 66 C22 66 10 56 10 38 C10 24 20 10 36 10Z";
      case "tall":
        return "M36 6 C48 6 54 18 54 32 C54 50 48 68 36 68 C24 68 18 50 18 32 C18 18 24 6 36 6Z";
      case "long":
        return "M14 36 C14 28 20 18 36 16 C52 14 58 24 58 36 C58 48 52 56 36 58 C20 60 14 48 14 36Z";
      default:
        return "M36 8 C54 10 64 26 62 42 C60 58 50 68 36 68 C22 68 12 58 10 42 C8 26 18 10 36 8Z";
    }
  }

  function bodySilhouette(body, color, clipId) {
    var path = bodyPath(body);
    return (
      '<defs><clipPath id="' +
      clipId +
      '"><path d="' +
      path +
      '"/></clipPath></defs>' +
      '<path d="' +
      path +
      '" fill="' +
      color +
      '"/>'
    );
  }

  function bellyAccent(body, accent) {
    var cy = body === "tall" ? 48 : body === "long" ? 42 : 46;
    var rx = body === "long" ? 16 : 14;
    var ry = body === "tall" ? 12 : 10;
    return '<ellipse cx="36" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + accent + '"/>';
  }

  function extraWings(c, accent) {
    return (
      '<ellipse cx="14" cy="38" rx="12" ry="16" fill="' +
      c +
      '" opacity="0.85"/>' +
      '<ellipse cx="58" cy="38" rx="12" ry="16" fill="' +
      c +
      '" opacity="0.85"/>' +
      '<ellipse cx="12" cy="36" rx="6" ry="9" fill="' +
      accent +
      '" opacity="0.5"/>'
    );
  }

  function extraTail(c, accent) {
    return (
      '<path d="M58 40 Q68 32 66 48 Q62 52 58 46Z" fill="' +
      c +
      '" stroke-linecap="round"/>' +
      '<ellipse cx="64" cy="44" rx="4" ry="3" fill="' +
      accent +
      '" opacity="0.6"/>'
    );
  }

  function extraSpots(clipId, c) {
    return (
      '<g clip-path="url(#' +
      clipId +
      ')">' +
      '<circle cx="24" cy="32" r="4" fill="' +
      c +
      '" opacity="0.35"/>' +
      '<circle cx="44" cy="28" r="3.5" fill="' +
      c +
      '" opacity="0.35"/>' +
      '<circle cx="38" cy="48" r="3" fill="' +
      c +
      '" opacity="0.35"/>' +
      "</g>"
    );
  }

  function extraStripes(clipId, c) {
    return (
      '<g clip-path="url(#' +
      clipId +
      ')">' +
      '<path d="M18 30 Q36 26 54 30" fill="none" stroke="' +
      c +
      '" stroke-width="3" opacity="0.35" stroke-linecap="round"/>' +
      '<path d="M16 42 Q36 38 56 42" fill="none" stroke="' +
      c +
      '" stroke-width="3" opacity="0.35" stroke-linecap="round"/>' +
      '<path d="M20 52 Q36 48 52 52" fill="none" stroke="' +
      c +
      '" stroke-width="2.5" opacity="0.3" stroke-linecap="round"/>' +
      "</g>"
    );
  }

  function eyesBig() {
    return (
      '<circle cx="26" cy="32" r="6" fill="#fff"/>' +
      '<circle cx="46" cy="32" r="6" fill="#fff"/>' +
      '<circle cx="27" cy="33" r="3" fill="' +
      EYE +
      '"/>' +
      '<circle cx="47" cy="33" r="3" fill="' +
      EYE +
      '"/>'
    );
  }

  function eyesSleepy() {
    return (
      '<path d="M20 32 Q26 28 32 32" fill="none" stroke="' +
      EYE +
      '" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path d="M40 32 Q46 28 52 32" fill="none" stroke="' +
      EYE +
      '" stroke-width="2.5" stroke-linecap="round"/>'
    );
  }

  function eyesGoogly() {
    return (
      '<circle cx="26" cy="32" r="7" fill="#fff"/>' +
      '<circle cx="46" cy="32" r="7" fill="#fff"/>' +
      '<circle cx="28" cy="30" r="4" fill="' +
      EYE +
      '"/>' +
      '<circle cx="44" cy="34" r="4" fill="' +
      EYE +
      '"/>'
    );
  }

  function eyesSparkly() {
    return (
      '<circle cx="26" cy="32" r="5" fill="#fff"/>' +
      '<circle cx="46" cy="32" r="5" fill="#fff"/>' +
      '<circle cx="27" cy="33" r="2.5" fill="' +
      EYE +
      '"/>' +
      '<circle cx="47" cy="33" r="2.5" fill="' +
      EYE +
      '"/>' +
      '<circle cx="24" cy="29" r="1.5" fill="#fff"/>' +
      '<circle cx="44" cy="29" r="1.5" fill="#fff"/>'
    );
  }

  function eyesHappy() {
    return (
      '<path d="M20 30 Q26 24 32 30" fill="none" stroke="' +
      EYE +
      '" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path d="M40 30 Q46 24 52 30" fill="none" stroke="' +
      EYE +
      '" stroke-width="2.5" stroke-linecap="round"/>'
    );
  }

  function renderEyes(kind) {
    switch (kind) {
      case "sleepy":
        return eyesSleepy();
      case "googly":
        return eyesGoogly();
      case "sparkly":
        return eyesSparkly();
      case "happy":
        return eyesHappy();
      default:
        return eyesBig();
    }
  }

  function mouthSmile() {
    return (
      '<path d="M28 46 C32 52 40 52 44 46" fill="none" stroke="' +
      EYE +
      '" stroke-width="2.5" stroke-linecap="round"/>'
    );
  }

  function mouthOpenMunch() {
    return (
      '<ellipse cx="36" cy="48" rx="8" ry="6" fill="#fff"/>' +
      '<path d="M28 48 C32 54 40 54 44 48" fill="none" stroke="' +
      EYE +
      '" stroke-width="2" stroke-linecap="round"/>'
    );
  }

  function mouthTinyO() {
    return '<circle cx="36" cy="48" r="3" fill="none" stroke="' + EYE + '" stroke-width="2" stroke-linecap="round"/>';
  }

  function mouthGrin() {
    return (
      '<path d="M26 44 C30 52 42 52 46 44" fill="none" stroke="' +
      EYE +
      '" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path d="M30 48 L32 50 M40 50 L42 48" fill="none" stroke="' +
      EYE +
      '" stroke-width="1.5" stroke-linecap="round"/>'
    );
  }

  function renderMouth(kind) {
    switch (kind) {
      case "open-munch":
        return mouthOpenMunch();
      case "tiny-o":
        return mouthTinyO();
      case "grin":
        return mouthGrin();
      case "none":
        return "";
      default:
        return mouthSmile();
    }
  }

  function extraHorn(c, accent) {
    return (
      '<path d="M36 8 L32 22 Q36 18 40 22Z" fill="' +
      c +
      '" stroke-linecap="round"/>' +
      '<ellipse cx="36" cy="20" rx="3" ry="2" fill="' +
      accent +
      '"/>'
    );
  }

  function extraHorns(c, accent) {
    return (
      '<path d="M24 14 L20 26 Q24 22 28 24Z" fill="' +
      c +
      '" stroke-linecap="round"/>' +
      '<path d="M48 14 L52 26 Q48 22 44 24Z" fill="' +
      c +
      '" stroke-linecap="round"/>' +
      '<circle cx="22" cy="24" r="2" fill="' +
      accent +
      '"/>' +
      '<circle cx="50" cy="24" r="2" fill="' +
      accent +
      '"/>'
    );
  }

  function extraEars(c, accent) {
    return (
      '<ellipse cx="16" cy="22" rx="7" ry="9" fill="' +
      c +
      '"/>' +
      '<ellipse cx="56" cy="22" rx="7" ry="9" fill="' +
      c +
      '"/>' +
      '<ellipse cx="16" cy="24" rx="4" ry="5" fill="' +
      accent +
      '"/>' +
      '<ellipse cx="56" cy="24" rx="4" ry="5" fill="' +
      accent +
      '"/>'
    );
  }

  function extraAntennae(c, accent) {
    return (
      '<path d="M28 14 Q26 4 24 8" fill="none" stroke="' +
      c +
      '" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M44 14 Q46 4 48 8" fill="none" stroke="' +
      c +
      '" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="24" cy="7" r="3" fill="' +
      accent +
      '"/>' +
      '<circle cx="48" cy="7" r="3" fill="' +
      accent +
      '"/>'
    );
  }

  function extraCrown(accent) {
    return (
      '<path d="M22 18 L26 8 L32 16 L36 6 L40 16 L46 8 L50 18Z" fill="' +
      accent +
      '" stroke-linecap="round"/>'
    );
  }

  function extraHat(c) {
    return (
      '<ellipse cx="36" cy="18" rx="20" ry="5" fill="' +
      c +
      '"/>' +
      '<path d="M26 18 L28 8 Q36 4 44 8 L46 18Z" fill="' +
      c +
      '" stroke-linecap="round"/>'
    );
  }

  function renderExtra(name, c, accent, clipId) {
    switch (name) {
      case "wings":
        return extraWings(c, accent);
      case "tail":
        return extraTail(c, accent);
      case "spots":
        return extraSpots(clipId, c);
      case "stripes":
        return extraStripes(clipId, c);
      case "horn":
        return extraHorn(c, accent);
      case "horns":
        return extraHorns(c, accent);
      case "ears":
        return extraEars(c, accent);
      case "antennae":
        return extraAntennae(c, accent);
      case "crown":
        return extraCrown(accent);
      case "hat":
        return extraHat(c);
      default:
        return "";
    }
  }

  var BEHIND = { wings: true, tail: true };
  var MARKINGS = { spots: true, stripes: true };
  var TOP = { horn: true, horns: true, ears: true, antennae: true, crown: true, hat: true };

  function render(parts, opts) {
    try {
      var p = normalizeParts(parts);
      var c = p.color;
      var accent = p.accent;
      var clipId = "mp-clip-" + ++clipSeq;
      var frags = [];
      var behind = [];
      var markings = [];
      var top = [];

      p.extras.forEach(function (ex) {
        if (BEHIND[ex]) behind.push(renderExtra(ex, c, accent, clipId));
        else if (MARKINGS[ex]) markings.push(renderExtra(ex, accent, c, clipId));
        else if (TOP[ex]) top.push(renderExtra(ex, c, accent, clipId));
      });

      frags = frags.concat(behind);
      frags.push(bodySilhouette(p.body, c, clipId));
      frags.push(bellyAccent(p.body, accent));
      frags = frags.concat(markings);
      frags.push(renderEyes(p.eyes));
      frags.push(renderMouth(p.mouth));
      frags = frags.concat(top);

      return (
        '<svg class="ent__svg" viewBox="0 0 72 72" aria-hidden="true">' +
        frags.join("") +
        "</svg>"
      );
    } catch (_) {
      var d = normalizeParts(null);
      return (
        '<svg class="ent__svg" viewBox="0 0 72 72" aria-hidden="true">' +
        bodySilhouette(d.body, d.color, "mp-fallback") +
        bellyAccent(d.body, d.accent) +
        renderEyes(d.eyes) +
        renderMouth(d.mouth) +
        "</svg>"
      );
    }
  }

  function load(url) {
    if (loadPromise) return loadPromise;
    var src = url || "banks/parts.json";
    loadPromise = fetch(src)
      .then(function (res) {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then(function (data) {
        if (data && data.bodies) {
          vocab = {
            bodies: data.bodies,
            eyes: data.eyes,
            mouths: data.mouths,
            extras: data.extras,
            defaults: data.defaults || EMBEDDED.defaults,
          };
          DEFAULTS = vocab.defaults;
          global.MashParts.vocab = vocab;
          global.MashParts.DEFAULTS = DEFAULTS;
        }
        loaded = true;
        return vocab;
      })
      .catch(function () {
        loaded = true;
        return vocab;
      });
    return loadPromise;
  }

  function isReady() {
    return loaded;
  }

  global.MashParts = {
    load: load,
    render: render,
    isReady: isReady,
    vocab: vocab,
    DEFAULTS: DEFAULTS,
  };
})(window);

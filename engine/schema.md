# GameSpec schema

Source of truth for a playable mash game. The runtime loads one JSON document and plays it.

```json
{
  "id": "string",
  "title": "string",
  "brand": "mashbaby",
  "copy": "Gate subtitle",
  "theme": {
    "wallColor": "#1a1218",
    "wallDotColors": ["#ff9ec5", "#c49bff"],
    "floorColor": "#f0c98a",
    "floorLine": "#e0b56e",
    "skyTop": "#7ec8ff",
    "skyBot": "#c9e9ff",
    "grassColor": "#6fbf5a",
    "waterColor": "#4aa8d8",
    "waterDeep": "#2f7fad",
    "accent": "#d45a7a",
    "gateBtnFrom": "#e08940",
    "gateBtnTo": "#d45a7a"
  },
  "scene": { "template": "kitchen-mash|sky-pop|pond-splash|blank-room", "props": {} },
  "onMash": [{ "kind": "cookie|icecream|balloon|duck|ball|star|customId", "weight": 65 }],
  "actors": [{ "kind": "baby|dino|puppy|customId", "behavior": "seek_and_munch", "max": 8 }],
  "ambient": [{ "kind": "birds|clouds|bubbles|sparkles", "count": 4 }],
  "sounds": {},
  "limits": { "maxSpawns": 18, "spawnCooldownMs": 90 },
  "parent": {
    "sessionMinutes": 10,
    "calmDefault": false
  },
  "customEntities": {
    "myThing": {
      "role": "spawn|actor|ambient",
      "width": 72,
      "height": 72,
      "svg": "<svg>...</svg>",
      "behavior": "drop_ready|float_pop|splash_swim|seek_and_munch|fly_across",
      "soundSpawn": "cookieDrop",
      "soundReady": "ovenDing",
      "soundInteract": "munch"
    }
  }
}
```

Runtime always **sanitizes** specs on boot (`engine/validate.js`): unknown scene templates fall back to `blank-room`, unknown `onMash` kinds are dropped (or remapped to star/ball), and a missing/broken spec loads the bundled cookies fallback so play never dead-ends on an error screen.

### Parent peace (`parent`)

Optional author / parent defaults for sensory load and session length:

| Field | Default | Notes |
|-------|---------|--------|
| `sessionMinutes` | `10` | Soft wind-down after N minutes of play. `0` disables. Clamped 0–60. Parent can change in the HUD timer control (persists in `localStorage`). |
| `calmDefault` | `false` | Start play in calm mode (lower volume, softer mash feedback, quieter motion). |

Debug: append `?windDownSec=15` to `engine/play.html` to trigger wind-down after 15 seconds.

### Kid-friendly customization (`customize`)

Optional in-game controls kids can mash during play — corner color palettes and cycle toggles. See [`engine/customize.js`](customize.js).

```json
"customize": {
  "persist": true,
  "wallPalette": true,
  "skyPalette": true,
  "toggles": [
    {
      "id": "dotStyle",
      "label": "✨",
      "corner": "top-left",
      "themeKeys": ["wallDotColors"],
      "options": [["#ff9ec5", "#c49bff"], ["#ffe066", "#ff9ec5"]]
    }
  ]
}
```

**Palette shorthands:** `wallPalette`, `floorPalette`, `skyPalette`, `grassPalette`, `waterPalette`.

**Advanced:** `"palettes": [{ "target": "wall", "corner": "top-right", "colors": ["#ff9ec5"] }]`

**Persist:** when `persist` is true (default), choices save to `localStorage` per game id.

**Standalone (legacy games):** load `customize.js`, then `MashCustomize.wallPalette(gameRoot, { onPick: (color) => ... })`.

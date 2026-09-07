# 02 — Sprite parts kit + palette bank

## Scope: appearance only

This phase builds **two of the builder's four slots** — what a creature looks
like (parts) and what colors the world uses (palettes).

It does **not** deliver motion or new worlds:

| Slot | Phase |
|---|---|
| Parts kit — appearance | **02 (this)** |
| Palettes — color/mood | **02 (this)** |
| Behaviors — motion | 07 |
| Backdrops — worlds | 08 |

Concretely, after this phase a "space dragon" wish yields a well-composed dragon
in space colors — but it still falls like a rock (07 fixes that) in a room that
still has an oven on the wall (08 fixes that). That is expected. Build this first
anyway: it is where the token savings and the always-cute guarantee live, and the
contact sheet lets George judge the art before anything depends on it.

## Why

This is the core technical bet of the whole plan. Read
[00-strategy.md](00-strategy.md) §3 before starting.

Today, a novel wish asks the LLM to author raw SVG (`grok.py` system prompt).
That is ~400 output tokens, slow, and quality is a coin flip — sometimes scary,
sometimes malformed, rarely on-brand.

Replace it with a **parts kit**. The model picks from a human-authored
vocabulary and returns ~30 tokens:

```json
{"body":"blob","color":"#7bc96f","eyes":"googly","extras":["horns","wings"]}
```

The renderer assembles the SVG locally. Result: **~10× cheaper output, always
cute, never scary, never malformed** — because George drew the parts, not a
language model.

Also add a **palette bank**: ~20 named theme presets. "turn it into space"
becomes a zero-token palette lookup instead of an LLM call.

## Design

### Single source of truth for the banks

The vocabulary is needed in two places: the **browser** (to render) and
**Python** (to build prompts and validate). Do not duplicate it in two
languages — it will drift.

Put the data in JSON under `engine/banks/`, already served statically by
`app.mount("/engine", ...)`:

- `engine/banks/parts.json` — the parts vocabulary + defaults
- `engine/banks/palettes.json` — named theme presets

The JS renderer imports it via `fetch` at boot; Python reads it off disk with
`json.load`. One file, two readers.

### New spec capability

`customEntities` entries currently carry a raw `svg` string. Add an alternative,
`parts`:

```json
"customEntities": {
  "wish_unicorn": {
    "role": "spawn",
    "parts": { "body": "egg", "color": "#ffd6ef", "accent": "#fff6e8",
               "eyes": "sparkly", "mouth": "smile", "extras": ["horn", "tail"] },
    "behavior": "hop_across",
    "soundSpawn": "inflate",
    "soundInteract": "munch"
  }
}
```

`svg` keeps working (backward compatible — existing shared `?wish=` links must
not break). When both are present, **`parts` wins**.

## Files

| File | Action |
|------|--------|
| `engine/banks/parts.json` | **create** — vocabulary + defaults |
| `engine/banks/palettes.json` | **create** — ~20 named themes |
| `engine/parts.js` | **create** — `MashParts` renderer |
| `engine/play.html` | modify — load `parts.js` before `entities.js` |
| `engine/entities.js` | modify — `meta()` passes `parts` through |
| `engine/spawn.js` | modify — `customHtml()` renders `parts` |
| `engine/validate.js` | modify — sanitize `parts` |
| `server/app/banks.py` | **create** — load JSON, expose vocab + palette lookup |
| `server/app/patches.py` | modify — palette intent |
| `server/app/grok.py` | modify — parts-based prompt + offline composer |
| `server/app/catalog.py` | modify — `glossary()` includes banks |
| `engine/schema.md` | modify — document `parts` |
| `tools/contact-sheet.html` | **create** — visual QA grid |

## Step 1 — `engine/banks/parts.json`

Shape:

```json
{
  "version": 1,
  "canvas": { "width": 72, "height": 72, "viewBox": "0 0 72 72" },
  "bodies":  ["blob", "egg", "round", "tall", "long"],
  "eyes":    ["big", "sleepy", "googly", "sparkly", "happy"],
  "mouths":  ["smile", "open-munch", "tiny-o", "grin", "none"],
  "extras":  ["horn", "horns", "ears", "wings", "tail", "antennae",
              "crown", "hat", "spots", "stripes"],
  "defaults": { "body": "blob", "eyes": "big", "mouth": "smile",
                "color": "#ff9ec5", "accent": "#ffe0f0" },
  "palette": ["#ff9ec5","#c49bff","#5ab0ff","#ffe066","#7bc96f",
              "#ff9a5a","#ff6b6b","#4aa8d8","#d4b0ff","#fff6e8"]
}
```

Keep `palette` aligned with `catalog.COLORS` values — same toddler-soft family.

## Step 2 — `engine/banks/palettes.json`

~20 named presets. Each maps a name to a partial `theme` object using the keys
`scene.js#applyTheme` already understands (`wallColor`, `wallDotColors`,
`floorColor`, `floorLine`, `skyTop`, `skyBot`, `grassColor`, `waterColor`,
`waterDeep`, `accent`, `gateBtnFrom`, `gateBtnTo`).

```json
{
  "version": 1,
  "palettes": {
    "space-night": {
      "keywords": ["space","galaxy","planet","rocket","stars","outer space","moon"],
      "theme": { "wallColor": "#1a1440", "wallDotColors": ["#ffe066","#c49bff"],
                 "skyTop": "#0f0b2a", "skyBot": "#3a2a6a",
                 "floorColor": "#2a2050", "accent": "#c49bff" },
      "ambient": [{ "kind": "sparkles", "count": 6 }]
    }
  }
}
```

Required names — author all of these:

`space-night`, `candy`, `jungle`, `underwater`, `snow`, `beach`, `sunset`,
`rainbow`, `pastel-dream`, `farm`, `desert`, `forest`, `bedroom-cozy`,
`birthday`, `halloween-soft`, `winter-holiday`, `neon-night`, `spring-garden`,
`storm-soft`, `cloud-castle`

Rules:
- Every palette must be **soft and toddler-safe**. `halloween-soft` and
  `storm-soft` are friendly and pastel — never dark, harsh, or spooky.
- Optional `ambient` array — merged additively, never replacing existing ambient.
- Keywords are matched case-insensitively as whole words.
- Contrast: entity art must stay readable against the backdrop. Avoid dark-on-dark.

## Step 3 — `engine/parts.js` (new)

Standard engine-global module (see README invariants). Exposes:

```js
global.MashParts = { load, render, isReady, vocab, DEFAULTS };
```

```js
// Fetch banks/parts.json once, memoized. Resolve even on failure (use embedded
// defaults) so play never blocks on a network hiccup.
async function load()

// parts -> SVG string. Pure, synchronous, no network.
function render(parts, opts)   // opts: { width, height }
```

**Embed a minimal fallback vocabulary as a JS literal** inside the module so
`render` works before/without `load()`. Play must never wait on a fetch.

### Layer order (critical — get this right or art looks broken)

Append in exactly this order so overlaps read correctly:

1. **Behind-body extras** — `wings`, `tail`
2. **Body** — the `bodies` shape, filled with `color`
3. **Belly/accent** — a lighter `accent` ellipse on the lower body
4. **Body markings** — `spots`, `stripes` (clipped to the body silhouette)
5. **Face** — `eyes`, then `mouth`
6. **Top extras** — `horn`, `horns`, `ears`, `antennae`, `crown`, `hat`

Implement one small function per part, e.g. `bodyBlob(c)`, `eyesGoogly()`,
`extraWings(c, accent)`, returning SVG fragment strings. Concatenate, wrap once:

```js
`<svg class="ent__svg" viewBox="0 0 72 72" aria-hidden="true">${frags.join("")}</svg>`
```

The `ent__svg` class and `aria-hidden="true"` are required — existing CSS and
a11y depend on them.

### Hard requirements

- **Never emit `<text>`, `<image>`, `<foreignObject>`, or `<script>`.** No
  readable text in entity art, ever (project invariant).
- Unknown part name ⇒ silently substitute the default. Never throw, never render
  empty. A malformed pick must still yield a cute creature.
- Coordinates assume the 72×72 viewBox; scaling is the caller's job via CSS.
- Faces read at 72px: eyes ≥ 4px radius, generous whites, 2px+ stroke on mouths.
- Every creature must look **friendly**. No fangs, no sharp angles, no red eyes.
  Rounded joins everywhere (`stroke-linecap="round"`).

### `parts` object contract

```
body   : string  (bodies enum)         default "blob"
color  : "#rrggbb"                     default "#ff9ec5"
accent : "#rrggbb"                     default: derived light tint of color
eyes   : string  (eyes enum)           default "big"
mouth  : string  (mouths enum)         default "smile"
extras : string[] (extras enum, max 3) default []
```

Cap `extras` at 3 — more looks cluttered at 72px. Truncate silently.

Derive `accent` when absent: mix `color` toward white ~65%. Write a tiny
`lighten(hex, amount)` helper; do not hand-write a lookup table like
`grok._accent_for`.

## Step 4 — wire the renderer in

**`engine/play.html`** — add before `entities.js` (line ~19); order matters:
```html
<script src="parts.js"></script>
```

**`engine/entities.js`** — in `meta()`, the custom-entity branch already returns
`svg: custom.svg`. Add one line:
```js
parts: custom.parts,
```

**`engine/spawn.js`** — `customHtml(meta)` at line ~45. Add a `parts` check
**before** the existing `meta.svg` check:
```js
function customHtml(meta) {
  if (meta.parts && global.MashParts) {
    return MashParts.render(meta.parts, { width: meta.width, height: meta.height });
  }
  if (meta.svg) { /* ...unchanged... */ }
  return MashEntities.render(meta.kind) || `<div class="ent__fallback">${meta.kind}</div>`;
}
```
`customHtml` is already used by `actorHtml` for non-built-in kinds, so actors get
parts support for free.

**`engine/runtime.js`** — call `MashParts.load()` during boot, but **do not await
it before first paint.** Fire and forget; `render` already works from embedded
defaults.

## Step 5 — `engine/validate.js`

`sanitize()` currently passes `customEntities` through untouched — an
injection hole now that specs arrive from URLs and the server.

Add `sanitizeParts(parts)`:
- Not a plain object ⇒ return `undefined`.
- `body`/`eyes`/`mouth`: keep only if a string in the known enum, else default.
- `color`/`accent`: keep only if matching `/^#[0-9a-fA-F]{3,8}$/`, else default.
- `extras`: filter to known enum strings, then `.slice(0, 3)`.
- Drop every other key.

Embed the enums as constants in `validate.js` (it must not depend on fetch).

Then sanitize each `customEntities` entry:
- `role` ∈ `{spawn, actor, ambient}`, else `"spawn"`.
- `width`/`height`: finite numbers clamped 16–240, else 72.
- `behavior`: string, else omit (`spawn.js` defaults to `drop_ready`).
- `parts`: via `sanitizeParts`.
- `svg`: **if present, reject any string containing `<script`, `<foreignObject`,
  `<image`, `on<attr>=`, or `javascript:`.** Drop the `svg` key if it fails.
  This is a real XSS vector — `customHtml` assigns to `innerHTML`, and specs come
  from shareable URLs. Treat a `?wish=` link as attacker-controlled input.
- Entry keeps neither valid `parts` nor valid `svg` ⇒ keep the entry (a built-in
  kind may resolve it) but let `kindResolvable` continue to govern.

## Step 6 — `server/app/banks.py` (new)

```python
"""Loads engine/banks/*.json — one source of truth shared with the browser."""

BANKS_DIR = Path(__file__).resolve().parents[2] / "engine" / "banks"

def parts_vocab() -> dict      # memoized json.load of parts.json
def palettes() -> dict         # memoized json.load of palettes.json
def match_palette(text: str) -> str | None
    """Whole-word, case-insensitive keyword match. Longest keyword wins."""
def palette_patch(name: str) -> dict
    """{"theme": {...}} plus {"ambient": [...]} when the palette defines it."""
def compact_vocab() -> dict
    """Token-cheap vocab for prompts: bare enum lists + palette names only.
    No keywords, no theme bodies, no comments."""
```

Memoize with a module-level dict (not `functools.cache` on a dict-returning
function — callers could mutate the shared object). Return **deep copies** from
`palette_patch`.

`compact_vocab()` matters: it is injected into every LLM call. Keep it to bare
lists. Do not dump the full palette themes into the prompt.

## Step 7 — `server/app/patches.py`

**Add a `palette` intent** — this is a large zero-token win.

In `classify_tweak`, after the `full_rethink` check and **before** the `theme`
color check:
```python
if banks.match_palette(lower):
    return "palette"
```
Order matters: "turn it into space" must hit `palette`, not fall through to
`freewheel`.

In `apply_tweak`, handle it:
```python
if intent == "palette":
    name = banks.match_palette(text)
    patch = banks.palette_patch(name)
    new_spec = apply_json_patch(new_spec, {"theme": patch["theme"]})
    # merge ambient additively — never replace
    for amb in patch.get("ambient", []):
        _ensure_ambient(new_spec, amb["kind"])
    return new_spec, intent, usage
```

`apply_json_patch` **replaces** the `ambient` list wholesale, so pass ambient
through `_ensure_ambient` instead — otherwise a "space" wish silently deletes
the ducks' existing birds.

Add a note in `main.py`'s note table:
`"palette": "Whoosh — a whole new world!"`

## Step 8 — `server/app/grok.py`

### Rewrite the system prompt

Delete the SVG-authoring instructions. The model now picks from enums.

- Inject `banks.compact_vocab()` and `catalog.glossary()`.
- Response shape:
  ```json
  {"patch": {"palette": "space-night",
             "customEntities": {"wish_x": {"role":"spawn","parts":{...},"behavior":"orbit"}},
             "title": "optional",
             "theme": {"...": "only for one-off colors not covered by a palette"}},
   "note": "warm short parent-facing line"}
  ```
- Rules to state explicitly:
  - Prefer a named `palette` over hand-picked `theme` colors.
  - Choose `behavior` from the behaviors enum — **motion is what makes it feel
    alive.** Never leave a creature on the default drop.
  - `parts` only; **never** return raw SVG. (Say this twice — it's the habit
    you're breaking.)
  - Never empty `onMash`. Never rewrite the whole game unless asked.
  - `note` should sound like a spell landing: *"A giggly monster joined the mash!"*
- Keep `temperature` ~0.55 and `response_format: json_object`.
- Trim `user_payload`: send only `id`/`title`/`scene.template`/`onMash` kinds/
  `actors` kinds and the wish. **Do not send the full theme or full
  `customEntities`** — the model no longer needs them, and they're most of the
  input cost today.

### Handle `palette` in the returned patch

`apply_json_patch` doesn't know about palettes. Before applying, expand it: if
`patch` has a `palette` key, pop it, resolve via `banks.palette_patch`, and merge
its theme *under* any explicit `patch["theme"]` (explicit colors win). Merge its
ambient via `_ensure_ambient`.

### Replace `_offline_freewheel` with a parts composer

Keep the function name and signature — `main.py` and phase 01's degrade path call
it. Rewrite the body:

- Reuse the existing keyword→shape logic in `_pick_shape`, but map to **parts
  descriptors** instead of hand-written SVG strings.
- Add a `SHAPE_PARTS` table, e.g.
  `"monster": {"body":"blob","eyes":"googly","mouth":"open-munch","extras":["horns"]}`,
  `"unicorn": {"body":"egg","eyes":"sparkly","extras":["horn","tail"]}`.
- Keep `_pick_color`; drop `_accent_for` (the renderer derives accent).
- **Delete all `_charming_svg` SVG-string branches.** ~150 lines go away — that is
  the point. The renderer owns art now.
- Also run `banks.match_palette(text)` here so offline wishes get theme changes
  too.
- Pick a `behavior` from the shape table, not from a hardcoded `float_pop`/
  `drop_ready` binary.
- Keep `usage["path"] = "offline_freewheel"`.

Expand `_pick_shape`'s keyword table to cover the top toddler asks so the offline
path is genuinely good: unicorn, dragon, kitty/cat, puppy/dog, truck, digger,
train, rocket, robot, bunny, bear, elephant, monkey, penguin, snowman, fish,
bee, ladybug, frog, pig, cow, duck, sheep, horse, lion, tiger, owl, crab.

## Step 9 — `server/app/catalog.py`

Extend `glossary()` with `parts` and `palettes` from `banks.compact_vocab()`.
Keep it token-cheap: bare lists only. `/api/catalog` returns this, and
`engine/wishes.js` uses it for chips — so new palettes surface as suggestion
chips for free.

## Step 10 — `tools/contact-sheet.html` (new)

Static QA page, no server needed. This is how George judges the "aww" bar.

- Load `../engine/parts.js`.
- Render a labelled grid:
  - every `body` × every `eyes` (with default mouth/color)
  - every `extras` entry on the default body
  - ~24 randomized full creatures
  - each of the ~30 `SHAPE_PARTS` presets, labelled with its wish word
- Toggle buttons: light/dark backdrop, and 72px vs 144px, to check both scales.
- Label text in HTML **around** each SVG — never inside it.

Open with `python3 -m http.server 8765` → `/tools/contact-sheet.html`.

## Step 11 — `engine/schema.md`

Document `parts` in the `customEntities` block: the object contract, the enums,
`parts`-wins-over-`svg` precedence, and the ≤3 extras cap. Note that palettes are
a server-side wish concept, not a spec field.

## Do not

- Do not remove `svg` support. Existing `?wish=` links carry raw SVG and must
  keep working.
- Do not duplicate the bank vocabulary in both JS and Python. JSON is the source
  of truth.
- Do not let `render` throw or return empty for bad input — always a cute default.
- Do not put text inside any SVG.
- Do not `await` the banks fetch before first paint.
- Do not add a build step, bundler, or npm dependency. Plain browser globals.
- Do not change the mash loop, spawn timing, or sound behavior in this phase.

## Verify

```bash
# 1. Banks are valid JSON with all required palettes
python3 - <<'PY'
import json, pathlib
p = json.load(open('engine/banks/palettes.json'))['palettes']
need = {"space-night","candy","jungle","underwater","snow","beach","sunset",
        "rainbow","pastel-dream","farm","desert","forest","bedroom-cozy",
        "birthday","halloween-soft","winter-holiday","neon-night",
        "spring-garden","storm-soft","cloud-castle"}
print("count:", len(p)); print("missing:", need - set(p))
parts = json.load(open('engine/banks/parts.json'))
print("bodies:", len(parts['bodies']), "eyes:", len(parts['eyes']), "extras:", len(parts['extras']))
PY
# expect: count >= 20, missing: set()
```

```bash
# 2. "turn it into space" is a zero-token palette hit, not an LLM call
curl -s -X POST http://127.0.0.1:8787/api/wish -H 'Content-Type: application/json' \
  -d "{\"spec\": $(cat specs/duck-pond-splash.json), \"text\": \"turn it into space\"}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['intent'], d['turn_usage']['path'], d['spec']['theme'].get('wallColor'), d['turn_usage']['total_tokens'])"
# expect: palette deterministic <dark-ish hex> 0
```

```bash
# 3. Offline composer returns parts, never raw SVG
unset XAI_API_KEY
curl -s -X POST http://127.0.0.1:8787/api/wish -H 'Content-Type: application/json' \
  -d "{\"spec\": $(cat specs/babies-eating-cookies.json), \"text\": \"a friendly unicorn\"}" \
  | python3 -c "
import json,sys; d=json.load(sys.stdin)
ce=d['spec']['customEntities']
new=[k for k in ce if k.startswith('wish_')]
print('entity:', new)
e=ce[new[0]]
print('has parts:', 'parts' in e, '| has svg:', 'svg' in e, '| behavior:', e.get('behavior'))
print('parts:', e.get('parts'))
"
# expect: has parts: True | has svg: False | a non-default behavior
```

```bash
# 4. Palette ambient merges, does not replace
# Wish "space" on a spec that already has ambient; confirm the original
# ambient kinds are STILL present alongside sparkles.
```

```bash
# 5. Malicious spec is neutered
# Build a spec with customEntities.evil.svg = '<svg onload=alert(1)><script>x</script></svg>'
# Load it via ?wish= ; confirm sanitize dropped the svg key and no script ran.
```

**Visual QA (the real gate).** Open `/tools/contact-sheet.html`:
- [ ] Every body × eyes combination reads as a friendly creature
- [ ] No clipping, no floating extras, no z-order mistakes (wings behind, horns on top)
- [ ] Readable at 72px, still clean at 144px
- [ ] Works on light and dark backdrops
- [ ] Nothing scary, sharp, or sad-looking
- [ ] Zero text glyphs inside any SVG

**In-play QA.** Load Babies Eating Cookies, hold ★, wish `a friendly unicorn`.
Confirm it spawns, moves with its assigned behavior, makes a sound, and mash
still feels instant.

**Token check.** With `XAI_API_KEY` set, wish something genuinely novel and log
`turn_usage`. Compare against `git stash` on this phase. Expect a large drop in
`completion_tokens` (target: under ~150, down from ~400+).

## Done when

- [ ] All five Verify commands produce the expected output
- [ ] Contact sheet passes every visual checkbox — **George signs off on the art
      before the prompt layer is considered final**
- [ ] `grok.py` contains no SVG-string literals
- [ ] `completion_tokens` for a novel wish drops materially
- [ ] Existing specs and old `?wish=` SVG links still play unchanged
- [ ] `engine/schema.md` documents `parts`

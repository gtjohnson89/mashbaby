# 08 — Backdrop bank: worlds, not just paint

**Requires phase 02** (palettes carry the backdrop hints).
**Do after phase 07** — motion affects every wish; backdrops only affect
"turn it into X" wishes, and this phase is much more art work.

## Why

Phase 02 made creatures composable and added ~20 palettes. But palettes only
recolor. There are still exactly **five scene templates**, so:

> Wish "turn it into space" on the cookies game → you get a properly composed
> space dragon and space-night colors and sparkles — **on a wall that still has
> an oven and a freezer bolted to it.**

The paint changed; the world didn't. That oven is the single most immersion-
breaking thing left in the wish flow.

An earlier draft of `00-strategy.md` promised "~18 backdrops." That was
aspirational and has been corrected to 10. This phase is where backdrops actually
get built, and it deliberately does **not** build 18 — see the strategy below.

## Strategy: parameterize first, author second

Authoring 13 new scenes (HTML structure + CSS + spawn zones, each looking right
under 20 palettes) is more work than phases 02 and 07 combined. Most of the pain
isn't the missing worlds — it's the *wrong furniture* in the world you're in.

So, in order:

1. **Prop suppression (cheap, big win).** Make the five existing scenes able to
   hide their identifying furniture. `kitchen-mash` minus oven/freezer/shelf is a
   generic room that reads fine as space, candy land, or a bedroom. This kills
   the jarring-oven problem across *every* palette immediately.
2. **Author 4 new worlds (targeted).** Only the highest-demand ones:
   `space-float`, `under-sea`, `jungle-vines`, `beach-shore`.
3. Stop there. Extend later from real wish data (the phase-03 spellbook's
   `hit_count` tells you which worlds parents actually ask for — use it instead
   of guessing).

Roughly 20% of the work for ~80% of the effect.

## The dead hook you're activating

`spec.scene.props` already exists and is preserved through
`validate.js#sanitize` (line ~144), threaded through `catalog.py` defaults —
**and passed to nothing.** `scene.js#render` calls `fn(theme)`, dropping props on
the floor. That is the extension point; wire it up rather than inventing a new
field.

## Files

| File | Action |
|------|--------|
| `engine/scene.js` | modify — pass props; 4 new renderers |
| `engine/styles.css` | modify — CSS for new scenes + prop-hiding |
| `engine/banks/backdrops.json` | **create** — backdrop registry + prop vocab |
| `engine/banks/palettes.json` | modify — `scene` / `sceneProps` hints |
| `engine/validate.js` | modify — new templates, sanitize props |
| `server/app/banks.py` | modify — backdrop vocab, palette scene hints |
| `server/app/catalog.py` | modify — `TEMPLATES` entries for new worlds |
| `server/app/grok.py` | modify — backdrop in the pick schema |
| `engine/schema.md` | modify — document `scene.props` + new templates |
| `tools/backdrop-lab.html` | **create** — every backdrop × every palette |

## Step 1 — props plumbing in `engine/scene.js`

Change the dispatch to pass props:

```js
const props = (spec.scene && spec.scene.props) || {};
container.innerHTML = fn(theme, props) + `<div id="stage" class="stage" aria-live="polite"></div>`;
```

Update all six existing renderers to `function kitchen(theme, props)` etc.

**Prop convention:** each prop defaults to **shown**, so every existing spec
renders byte-identically with `props: {}`. Only an explicit `false` hides it.

```js
function show(props, key) { return props[key] !== false; }
```

Per-scene suppressible props:

| Scene | Props |
|---|---|
| `kitchen-mash` | `oven`, `freezer`, `shelf`, `pan` |
| `sky-pop` | `sun`, `clouds`, `grass` |
| `pond-splash` | `sun`, `clouds`, `lilies`, `reeds` |
| `pantry-nibble` | `shelves`, `iceCream`, `cheese`, `mouseHoles` |
| `trashcan-alley` | `windows`, `crumbs`, `can` |
| `blank-room` | (none) |

**Never let a prop remove the spawn zone.** `pan`, `can`, and the floor/pond
elements carry `data-spawn-zone` / `data-actor-home`. If a prop would hide one,
emit a plain invisible zone div in its place. `render()` returning a null
`spawnZone` breaks all spawning — this is the biggest risk in the phase.

Guard it: after building HTML, assert a `[data-spawn-zone]` exists; if not,
append a default full-floor zone. Belt and braces.

## Step 2 — `engine/banks/backdrops.json` (new)

```json
{
  "version": 1,
  "backdrops": {
    "kitchen-mash": {
      "keywords": ["kitchen","oven","bake","cookie"],
      "props": ["oven","freezer","shelf","pan"],
      "themeKeys": ["wallColor","wallDotColors","floorColor","floorLine"]
    },
    "space-float": {
      "keywords": ["space","galaxy","planet","rocket","moon","stars"],
      "props": ["planets","stars","ship"],
      "themeKeys": ["skyTop","skyBot","accent"]
    }
  }
}
```

`themeKeys` documents which theme keys each backdrop actually consumes — needed
so a palette can be checked for compatibility (a pond palette setting only
`waterColor` does nothing for a kitchen).

Include all 6 existing + 4 new = 10 backdrops.

## Step 3 — author the four new scenes

For each: a renderer in `scene.js` + CSS in `styles.css` + `KNOWN_TEMPLATES`
entry + a `catalog.TEMPLATES` entry with keywords and `default_spec`.

| Backdrop | Structure | Spawn zone |
|---|---|---|
| `space-float` | dark gradient sky, stars, 2 planets, optional ship | full-area float zone |
| `under-sea` | water gradient, seabed, coral, seaweed, light rays | mid-water zone |
| `jungle-vines` | layered canopy, hanging vines, big leaves, forest floor | floor zone |
| `beach-shore` | sky, sea band, wet sand, dry sand, palm, shells | sand zone |

Requirements:
- Pure CSS/HTML in the established style — gradients, `border-radius`,
  `box-shadow`. **No images, no SVG files, no new assets.** Match how `pond` and
  `alley` are built.
- Drive every color from the CSS custom properties `applyTheme` already sets
  (`--sky-top`, `--water-color`, `--wall-color`, `--accent`, …). Hardcoded colors
  break palettes — that is the whole point of this phase.
- Exactly one `[data-spawn-zone]`. Add `[data-actor-home]` only if actors have
  somewhere to emerge from.
- Ambient decoration must be `pointer-events: none` so it never eats a mash.
- Respect `prefers-reduced-motion` and calm mode for any drifting/animated
  decoration.
- Keep the DOM small — these render under 18 live spawns on a cheap laptop.

## Step 4 — palettes gain scene hints

In `palettes.json`, add two optional fields per palette:

```json
"space-night": {
  "keywords": ["space","galaxy","planet","rocket"],
  "theme": { "...": "..." },
  "ambient": [{ "kind": "sparkles", "count": 6 }],
  "scene": "space-float",
  "sceneSwap": true,
  "sceneProps": { "oven": false, "freezer": false, "shelf": false }
}
```

**`sceneSwap` is the important guardrail.** Only *world* palettes may replace the
backdrop:

- `sceneSwap: true` — `space-night`, `underwater`, `jungle`, `beach`, `farm`,
  `snow`, `cloud-castle`, `desert`, `forest`
- `sceneSwap: false` (or absent) — pure color moods: `rainbow`, `candy`,
  `pastel-dream`, `sunset`, `neon-night`, `birthday`, `storm-soft`,
  `bedroom-cozy`, `halloween-soft`, `winter-holiday`, `spring-garden`

Wishing "make it rainbow" on the duck pond must **not** teleport you out of the
pond. Wishing "turn it into space" should. That distinction is the difference
between magic and a bug.

Palettes without `sceneSwap` may still carry `sceneProps` — that's how "candy
land" hides the oven while staying in the room.

## Step 5 — `server/app/banks.py`

```python
def backdrops() -> dict                       # memoized backdrops.json
def backdrop_names() -> list[str]
def palette_scene(name: str) -> tuple[str | None, dict]
    """(backdrop_or_None, sceneProps). Returns None when sceneSwap is falsy."""
```

Extend `compact_vocab()` with `backdrops` (bare name list) and each backdrop's
prop names. Keep it terse — it ships in every prompt.

Extend `palette_patch()` to include `scene` and `sceneProps` when
`sceneSwap` is true.

## Step 6 — apply scene changes

In `patches.py`, the `palette` intent (added in phase 02) must now also apply the
backdrop:

```python
name = banks.match_palette(text)
patch = banks.palette_patch(name)
backdrop, scene_props = banks.palette_scene(name)
if backdrop:
    new_spec["scene"] = {"template": backdrop, "props": scene_props}
elif scene_props:
    new_spec.setdefault("scene", {}).setdefault("props", {}).update(scene_props)
```

Merge props, never replace, when staying in the same backdrop.

Same handling in `grok.py#apply_patch_with_palette` so LLM and deterministic
paths behave identically. Let the model return a `backdrop` key directly too
(validated against `banks.backdrop_names()`; ignore unknown values).

**Runtime note:** `applySpec` rebuilds the scene, so a backdrop swap clears live
spawns. That is acceptable and reads as part of the spell — but confirm the
transition doesn't flash white or drop the HUD.

## Step 7 — `engine/validate.js`

- Add the 4 new names to `KNOWN_TEMPLATES`.
- Sanitize props: plain object; **boolean values only**; drop unknown keys per
  the template's known prop list; cap at 20 keys. Embed the prop lists as
  constants (validate.js must not fetch).

## Step 8 — `tools/backdrop-lab.html`

Grid of every backdrop × a palette selector, plus per-prop checkboxes so each
can be toggled live. This is how you confirm all 10 backdrops survive all 20
palettes without authoring 200 screenshots by hand.

## Do not

- Do not author 13 backdrops. Four, then stop and read spellbook demand.
- Do not let any prop remove the last `[data-spawn-zone]`.
- Do not hardcode colors in new scenes — use the theme custom properties.
- Do not change default rendering of existing scenes. `props: {}` must be pixel-
  identical to today.
- Do not let non-world palettes swap the backdrop.
- Do not add image or SVG asset files.
- Do not replace a props object wholesale when merging.

## Verify

```bash
# 1. Existing specs render unchanged (props default to shown)
python3 -c "
import json,glob
for f in sorted(glob.glob('specs/*.json')):
    s=json.load(open(f)); print(f, s['scene']['template'], s['scene'].get('props'))
"
# expect: every props == {} ; visually diff each game against pre-phase screenshots
```

```bash
# 2. Ten backdrops registered consistently across all three sources
python3 -c "
import json,re
b=set(json.load(open('engine/banks/backdrops.json'))['backdrops'])
v=set(re.findall(r'\"([a-z-]+)\": true', open('engine/validate.js').read()))
from server.app import catalog
print('backdrops.json:', len(b), sorted(b))
print('missing from validate.js:', b - v)
print('missing from catalog.TEMPLATES:', b - set(catalog.TEMPLATES))
"
# expect: 10 backdrops; both 'missing' sets empty
```

```bash
# 3. World palette swaps the scene; color palette does not
curl -s -X POST http://127.0.0.1:8787/api/wish -H 'Content-Type: application/json' \
  -d "{\"spec\": $(cat specs/babies-eating-cookies.json), \"text\": \"turn it into space\"}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('space ->', d['spec']['scene'])"
# expect: template space-float

curl -s -X POST http://127.0.0.1:8787/api/wish -H 'Content-Type: application/json' \
  -d "{\"spec\": $(cat specs/duck-pond-splash.json), \"text\": \"make it rainbow\"}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('rainbow ->', d['spec']['scene'])"
# expect: template STILL pond-splash
```

```bash
# 4. Prop suppression reaches the DOM
# Load a kitchen spec with props {"oven": false, "freezer": false}.
# In DevTools: document.querySelectorAll('.oven, .freezer').length  -> 0
#              document.querySelectorAll('[data-spawn-zone]').length -> 1
```

```bash
# 5. Hostile props are sanitized
# Spec with props {"oven": "yes", "__proto__": {}, "unknownThing": true}
# -> sanitized to {} or {} plus only known boolean keys; game still plays.
```

```bash
# 6. Spawn zone survives every prop combination — the critical check
# For EACH backdrop, set every prop to false. Confirm mashing still spawns
# tappable things. A null spawnZone silently breaks all spawning.
```

**Visual QA** via `tools/backdrop-lab.html`:
- [ ] All 10 backdrops × 20 palettes: no unreadable or dark-on-dark combination
- [ ] Creature art stays legible against every backdrop
- [ ] The 4 new worlds look intentional, soft, toddler-friendly
- [ ] Prop toggles never leave a visual hole or orphaned shadow
- [ ] Decoration never intercepts a mash (`pointer-events: none`)
- [ ] Calm mode and reduced-motion respected

**In-play QA.** From the cookies game, wish "turn it into space": the oven and
freezer are gone, the world is space, the dragon has apt motion (phase 07), and
mash still feels instant. **This is the flagship demo — it should feel like a
spell.** Then Undo and confirm the kitchen returns intact.

## Done when

- [ ] All six Verify commands pass
- [ ] Visual QA checklist complete
- [ ] All five shipped packs pixel-identical to pre-phase
- [ ] No prop combination can break spawning
- [ ] World palettes swap scenes; color palettes never do
- [ ] `engine/schema.md` documents `scene.props` and all 10 templates

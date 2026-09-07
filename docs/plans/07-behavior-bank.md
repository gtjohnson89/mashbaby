# 07 — Behavior bank: 5 → 15 motions

**Requires phase 02** (the LLM picks behaviors from the bank vocabulary).

## Why

**Motion is what a toddler reads as alive.** A perfect unicorn SVG bound to
`drop_ready` is a falling sticker. A crude one that gallops is a unicorn.

Phase 02 made *appearance* richly composable but left motion at five spawn
behaviors, so it is now the binding constraint on how novel a wish can feel.

## Current inventory

`engine/spawn.js#spawnOne` dispatches:

| Behavior | Function |
|---|---|
| `bake_ready` | `spawnBakeReady` |
| `drop_ready` | `spawnDropReady` (also the default) |
| `float_pop` | `spawnFloatPop` |
| `splash_swim` | `spawnSplashSwim` |
| `scurry_nibble` | `spawnScurryNibble` |

Actors (`sendActor`): `seek_and_munch`, `pop_from_can`.
Ambient (`ambient.js`): `fly_across`, `drift`, `rise`, `twinkle`.

## Add these ten spawn behaviors

| Behavior | Feel | Fits wishes like |
|---|---|---|
| `bounce_roll` | drops, bounces, rolls off | ball, apple, wheel |
| `hop_across` | arcing hops left↔right | bunny, frog, kangaroo |
| `fly_loop` | loops through the air | butterfly, bee, bird, fairy |
| `orbit` | circles a point, slow spin | planet, moon, star, satellite |
| `burrow_pop` | pops from the floor, ducks back | mole, worm, gopher |
| `wiggle_grow` | appears small, wiggles, swells | balloon, cake, flower |
| `stack_up` | lands and stacks on prior spawns | blocks, pancakes, boxes |
| `melt_puddle` | slumps into a puddle, fades | ice cream, snowman |
| `launch_rocket` | shoots up and off-screen | rocket, firework |
| `chug_across` | rolls steadily across the floor | train, truck, digger, bus |

`chug_across` and `hop_across` are the highest-value adds — vehicles and hoppy
animals are enormous in the 1–3 wish distribution and currently both just fall.

## Files

| File | Action |
|------|--------|
| `engine/spawn.js` | modify — 10 new behavior functions + dispatch |
| `engine/styles.css` | modify — keyframes/transitions |
| `engine/banks/parts.json` | modify — add `behaviors` enum |
| `server/app/banks.py` | modify — expose behaviors in `compact_vocab()` |
| `server/app/grok.py` | modify — behavior guidance in prompt |
| `server/app/catalog.py` | modify — `glossary()` behaviors |
| `engine/schema.md` | modify — document each behavior |
| `tools/behavior-lab.html` | **create** — visual motion QA |

## Implementation notes

**Follow the existing shape.** Each `spawnX(ctx, kind, meta)` should:
1. Compute a position from `zoneRect(ctx.spawnZone, ctx.root)`.
2. Build the element via `makeEl(meta, html, x, y, mode)` — `"css"` for
   left/top animation, `"transform"` for translate-driven motion.
3. `ctx.stage.appendChild(el)`.
4. Play `meta.soundSpawn`; play `meta.soundInteract` on tap/hit.
5. Register the tap/hit handler the way sibling functions do.
6. **Decrement `ctx.spawnCount` in every exit path.** Study `spawnDropReady` and
   `spawnScurryNibble` — a missed decrement leaks the spawn budget and the game
   silently stops spawning. This is the most likely bug in this phase.

**Respect calm mode.** Read the same signal the existing behaviors use (check
`motion.js` / `runtime.js` for how calm attenuates motion). Calm must soften
amplitude and speed. `launch_rocket` and `bounce_roll` especially need taming.

**Respect `prefers-reduced-motion`** — reduce travel and disable spin.

**Timing budget.** Every behavior must reach a tappable state fast. A toddler
mashes ~3–5×/second; anything that takes >600ms to become interactive feels
broken. Cap total lifetime ~6s so the stage self-clears under
`limits.maxSpawns`.

**Prefer CSS transforms** (`translate`/`rotate`/`scale`) over animating
`left`/`top`. This must stay smooth on a cheap laptop with 18 spawns live.
Avoid per-frame JS where a keyframe will do; where you need JS, use one shared
`requestAnimationFrame` loop rather than a timer per entity.

**`stack_up` needs shared state.** Track a per-`ctx` stack height so successive
spawns land on top. Reset it in the same place the stage clears (Reset button and
`applySpec`), or the stack drifts off-screen after a re-theme.

## Dispatch

Extend `spawnOne` with the new names. **Keep `drop_ready` as the final
fallback** — an unknown behavior must still spawn something tappable, never
nothing.

Add the `behaviors` enum to `parts.json` so it flows through `banks.compact_vocab()`
into the prompt and `/api/catalog` chips automatically.

## Prompt guidance in `grok.py`

Add a short mapping hint so the model picks motion well — this is the whole point
of the phase:

> Pick behavior by how the thing moves in real life: things that fly →
> `fly_loop`; hoppy animals → `hop_across`; vehicles → `chug_across`;
> space things → `orbit`; things that melt → `melt_puddle`.

Keep it to a few lines — it is in every request.

## `tools/behavior-lab.html`

Static page (same spirit as phase 02's contact sheet): a button per behavior that
spawns a parts creature using it, plus toggles for calm mode and reduced motion.
This is how motion gets judged without wishing repeatedly in-game.

## Do not

- Do not change the five existing behaviors' feel. Existing packs must look
  identical — regression-check all five specs.
- Do not remove `drop_ready` as the fallback.
- Do not add a physics or animation library.
- Do not animate `left`/`top` where a transform works.
- Do not exceed ~6s lifetime or delay interactivity past ~600ms.
- Do not create a timer or rAF loop per entity.

## Verify

```bash
# 1. All 15 behaviors are dispatched
grep -c 'behavior === "' engine/spawn.js
python3 -c "
import json; b=json.load(open('engine/banks/parts.json'))['behaviors']
print(len(b), sorted(b))
"
# expect: 15 behaviors listed
```

```bash
# 2. Behaviors reach the prompt vocabulary
curl -s http://127.0.0.1:8787/api/catalog | python3 -c "import json,sys; print(json.load(sys.stdin).get('behaviors'))"
# expect: the full list
```

```bash
# 3. Unknown behavior still spawns (fallback intact)
# Load a spec with behavior "nonsense_xyz"; confirm something tappable appears
# and the console is clean.
```

```bash
# 4. No spawn-budget leak — the critical check
# For EACH of the 15 behaviors: mash ~60 keys, then confirm spawns still appear
# and the live element count settles at/below limits.maxSpawns.
# In DevTools: document.querySelectorAll('#stage .ent').length
# A behavior that leaks will visibly stop spawning. Test all fifteen.
```

**Motion QA** via `tools/behavior-lab.html`:
- [ ] Each behavior is legible and delightful at a glance
- [ ] Interactive within ~600ms; gone within ~6s
- [ ] Calm mode softens every behavior
- [ ] `prefers-reduced-motion` reduces travel and disables spin
- [ ] 18 simultaneous spawns stay smooth (no jank on a low-end machine)
- [ ] `stack_up` resets correctly on Reset and after a wish re-theme

**Regression QA:** play all five shipped specs. Cookie baking, balloon pops, duck
splashing, mouse scurrying, and monster pop-from-can must feel exactly as before.

## Done when

- [ ] All four Verify commands pass
- [ ] Motion QA checklist complete
- [ ] **No spawn-budget leak in any of the 15 behaviors** (explicitly tested)
- [ ] All five existing packs play unchanged
- [ ] Novel wishes visibly pick varied, apt motion — not everything falling
- [ ] `engine/schema.md` documents all 15

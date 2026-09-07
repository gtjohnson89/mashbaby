# mashbaby build plans

Ordered, self-contained implementation plans. Each file is one phase.
**Do phases in order.** Each assumes the previous ones are merged.

| # | Plan | Goal | Blocking? |
|---|------|------|-----------|
| 00 | [00-strategy.md](00-strategy.md) | Why these phases, decisions already made | read first |
| 01 | [01-secure-wish-api.md](01-secure-wish-api.md) | Stop `/api/wish` from being a free LLM faucet | **yes — blocks hosting** |
| 02 | [02-parts-kit-and-palettes.md](02-parts-kit-and-palettes.md) | Sprite parts kit + palette bank | no |
| 03 | [03-spellbook-cache.md](03-spellbook-cache.md) | Cache + pre-seed common wishes | needs 02 |
| 04 | [04-saved-games.md](04-saved-games.md) | Private-link saves + "Our Games" shelf | no |
| 05 | [05-license-unlock.md](05-license-unlock.md) | One-time family unlock (Stripe + key) | needs 01 |
| 06 | [06-voice-wishes.md](06-voice-wishes.md) | Hold star, speak the wish | no |
| 07 | [07-behavior-bank.md](07-behavior-bank.md) | 5 → 15 motion behaviors | needs 02 |
| 08 | [08-backdrop-bank.md](08-backdrop-bank.md) | Hide scene furniture + 4 new worlds | needs 02, do after 07 |

**The "game builder" is four slots across four phases** — 02 gives appearance
and color, 07 gives motion, 08 gives worlds. No single phase delivers all of it;
see the slot table in [00-strategy.md](00-strategy.md).

## How to work these plans

1. **Read `00-strategy.md` first.** It explains the product reasoning. Do not
   re-litigate decisions recorded there.
2. Read the whole phase file before writing code.
3. Follow the **Files** table exactly — create/modify only what it lists. If you
   believe another file must change, say so in your summary rather than
   silently widening scope.
4. Every phase ends with a **Verify** section containing runnable commands.
   Run them. Paste real output in your summary. Do not claim a phase is done
   without running its Verify block.
5. Respect the **Do not** list in each phase. Those are guardrails, not
   suggestions.

## Non-negotiable project invariants

These hold across every phase. Violating one is a bug even if the phase file
does not repeat it.

- **Play never dead-ends.** A bad/missing/hostile spec must still produce a
  mashable screen. `engine/validate.js#sanitize` is the safety net — extend it
  when you add spec fields, never bypass it.
- **Toddler-safe by construction.** No readable text inside entity art. Nothing
  scary, sharp, or realistic. Kid-facing controls stay mash-friendly.
- **Parent controls stay hold-gated.** Wish and Exit require a ~2s hold. Never
  add a tap-only path to a parent surface.
- **Catalog tweaks stay free, instant, and offline-capable.** They are the
  reliability floor under the AI. Never route a color change through an LLM.
- **GameSpec JSON is the source of truth.** Features are spec fields plus
  runtime interpretation — not hardcoded per-game branches.
- **Engine modules are browser globals**, not ES modules. Pattern:
  `(function (global) { "use strict"; ... global.MashThing = {...}; })(window);`
  Load order matters; it is set in `engine/play.html`.
- **No accounts.** Device-local + signed tokens + unlisted links only.
- **Never commit secrets.** `XAI_API_KEY`, Stripe keys, and
  `MASH_LICENSE_SECRET` come from the environment only.

## Repo orientation

```
index.html              dashboard (game tiles)
engine/
  play.html             loads a spec, boots runtime (script load order lives here)
  runtime.js            MashRuntime — boot, applySpec(), parent HUD, wind-down
  validate.js           MashValidate.sanitize() — spec safety net
  scene.js              MashScene — scene template renderers + applyTheme
  entities.js           MashEntities — built-in art + META table
  spawn.js              MashSpawn — spawn/actor behaviors
  ambient.js            MashAmbient — birds/clouds/bubbles/sparkles
  sounds.js             MashSounds — WebAudio kit
  customize.js          MashCustomize — kid corner palettes
  wishes.js             MashWishes — wish panel, jar, offline matcher, share
specs/*.json            the shipped game packs
server/app/
  main.py               FastAPI routes
  catalog.py            SPAWNS / ACTORS / AMBIENT / COLORS / TEMPLATES + glossary()
  patches.py            classify_tweak / apply_tweak / apply_json_patch (no LLM)
  grok.py               invent_or_patch + offline freewheel fallback
  db.py                 SQLAlchemy + SQLite
studio/                 George's private invent tool — not the customer product
```

## Local run

```bash
./server/run.sh                  # http://127.0.0.1:8787
```

Static-only (no wish API): `python3 -m http.server 8765`

# mashbaby

Games for **1–3 year olds** — keyboard-mash, tap-anywhere play — plus an **iteration-first game engine**.

**Design bar:** toddler-simple. Big taps, instant feedback, almost no reading, controls kids can mash (corner color palettes, toggles). Games and features should stay that easy.

## Product direction

Customer shape is **co-creation via Wishes**: parent + kid wish together inside play. **AI/generation is the soul**; the catalog is the instant/reliability floor (free unlimited tweaks). Novel creations spend **wish credits** (jar metaphor now; credit packs later). Studio stays George’s private invent tool. No public Studio, no accounts, no ads-to-kids.

→ Full north star, in/out, monetization, and build plan: [`docs/PRODUCT.md`](docs/PRODUCT.md)

## Quick play (static specs)

```bash
python3 -m http.server 8765
# open http://127.0.0.1:8765/
```

Dashboard games run through [`engine/play.html`](engine/play.html) + JSON specs in [`specs/`](specs/).

**Wishes** (parent hold ★ in the play HUD) work best with the API server below so catalog + generative patches apply. Without the server, an offline catalog matcher still handles common tweaks (colors, ducks, balloons, birds…).

### Try the magic (wish jar + spell beat)

```bash
chmod +x server/run.sh
./server/run.sh
# open http://127.0.0.1:8787/
# pick a game → mash a bit → hold ★ Wish ~2s
```

1. **Free tweak:** type `pink walls` or tap a chip — instant, unlimited, no credit spent.
2. **Novel creation:** type `friendly monster` or `turn it into space` — “Granting your wish…” beat, then a new mash item; costs **1 jar credit** (seeded free credits in `localStorage`).
3. After a wish: **Copy link** shares the live GameSpec in the URL (`?wish=…`); open that link on another device to see what you made.
4. **Undo** in the Wish panel rolls back the last applied wish.
5. Empty jar → novel wishes pause; free tweaks still work. (No Stripe yet — metaphor only.)

Optional Grok for higher-quality creations:

```bash
export XAI_API_KEY=your_key
export XAI_MODEL=grok-3-mini   # optional
./server/run.sh
```

## Studio + Wish API (private invent / live patches)

```bash
./server/run.sh
# open http://127.0.0.1:8787/          — play dashboard
# open http://127.0.0.1:8787/studio/   — private invent loop (George only)
```

Studio invents packs; it is not the customer product. Customer co-creation lives in the in-play Wish box.

## Architecture

- **GameSpec** JSON — source of truth (`theme`, `scene`, `onMash`, `actors`, `ambient`, `customEntities`)
- **Engine** ([`engine/`](engine/)) — shared runtime, scenes, spawns, ambient, sounds, Wish UI + jar
- **Catalog + patches** ([`server/app/catalog.py`](server/app/catalog.py), [`patches.py`](server/app/patches.py)) — free instant tweaks
- **Wish API** — `POST /api/wish` `{ spec, text }` → patched spec (stateless; coffee-table friendly)
- **Grok adapter** ([`server/app/grok.py`](server/app/grok.py)) — generative creations (charming offline invent when no key)
- **Studio** ([`studio/`](studio/)) — private prompt + tweak chat beside live play iframe

## Built-in games

| Game | Spec |
|------|------|
| Babies Eating Cookies | `specs/babies-eating-cookies.json` |
| Balloon Pop Party | `specs/balloon-pop-party.json` |
| Duck Pond Splash | `specs/duck-pond-splash.json` |
| Squeaky Mice | `specs/squeaky-mice.json` |

Parent controls in play (top-right strip):
- **Wish ★** — hold **~2 seconds** to open the parent Wish box; mash play ignores the overlay
- **Exit** — hold **2 seconds** (or **Esc**); progress ring fills; release early to cancel
- **Mute** — tap to mute (persists in `localStorage`); **hold ~0.7s** to unmute
- **Calm** — tap for quieter volume / softer mash / gentler motion; hold to turn off
- **Timer** — cycles Off → 5 → 10 → 15 min soft wind-down (moon overlay, one grace extension, then back to the start gate). Default 10 min; override via GameSpec `parent.sessionMinutes` or `?windDownSec=15` for a quick test
- **Reset** — clear the scene

## Kid customization templates

Toddler-mashable UI — corner color palettes and toggles, no menus. Games opt in via GameSpec `customize` (see [`engine/schema.md`](engine/schema.md)). Example — wall color picker on the cookies game:

```json
"customize": { "persist": true, "wallPalette": true }
```

Module: [`engine/customize.js`](engine/customize.js). Wired automatically when `engine/play.html` loads a spec with `customize` set.

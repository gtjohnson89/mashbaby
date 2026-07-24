# mashbaby — Product direction

Settled with Fable + Opus + George (2026-07). Practical north star for what we build next.

## North star

**Co-creation on the coffee-table laptop.** A parent speaks a wish with their kid — “more ducks”, “a friendly monster” — the world transforms, the toddler delights, and for a moment the parent feels like a magician. That shared spell is the product. Toddler mash is the safe substrate that makes it playable for ages 1–3.

**AI / generation is the soul.** Catalog patches are the **instant / reliability floor** (fast, free, always work) — not the creative ceiling, and not “Grok-last” as identity.

## Product shape: Wishes (not public Studio)

| Surface | Role |
|---------|------|
| **Play** | The product. Mash games for ages 1–3. Parent-gated **Wish box** (= the wand) inside play. |
| **Landing** | Pick a pack / optional “describe to play” later. Coffee-table web, not phone-app-first. |
| **Studio** | George’s **private** invent tool for packs and engine tests. Not the customer product. |

### What parents get

1. Parent-gated wish box **inside** play (hold to open — same abuse-proof pattern as Exit).
2. Two tiers, one honest line:
   - **Tweaks** (catalog): colors, more ducks, add birds — instant, **free, unlimited**.
   - **Creations** (generative): novel things — spend a **wish credit** from the jar.
3. Persistence via **localStorage** + **spec-in-URL** sharing. No accounts. No hosted UGC library.

### Audience & vessel

- Ages **1–3** for mash; parent is the creative co-player who makes wishes.
- **Web / laptop coffee-table** — websites fit this. Not phone-app-first.

### Monetization

- **Credit packs for novel creations** — primary model. Tweaks stay free forever.
- Tip jar is garnish only (“love this?”), not the engine.
- Wallet stays dumb: device-local balance first; Stripe/LemonSqueezy later. No accounts SaaS.

### Explicitly out

- Multi-user accounts / social feeds
- Ads targeting kids
- Hosted community library of user games
- Public “author a game” Studio as the customer shape

---

## What’s in / out of scope

**In**

- Curated game packs (GameSpec JSON + shared engine)
- Parent Wish → catalog tweak (free) or generative creation (credits)
- Soft offline: catalog tweaks always work; novel wishes get a charming invent stub or suggestions (never a sad blob)
- Kid corner customize (palettes/toggles) where a pack opts in
- Parent peace HUD (exit hold, mute, calm, timer)
- Wish jar metaphor (localStorage credits) before real payments

**Out (for now)**

- Hosted community library of user games
- Accounts, sync, multiplayer
- Phone-native apps
- Stripe / checkout plumbing (jar metaphor ships first)

## Architecture we already have (leverage)

```
Wish / tweak text
    → patches.classify_tweak / apply_tweak   (catalog floor — free)
    → grok.invent_or_patch                   (generative soul — credits)
    → MashRuntime.applySpec                  (live rebuild)
```

- Catalog: `server/app/catalog.py`
- Deterministic patches: `server/app/patches.py`
- Grok adapter + charming offline invent: `server/app/grok.py`
- Wish UI + jar + share: `engine/wishes.js`
- Runtime: 2s Exit hold, parent controls, `applySpec()`

---

## Wishes — build status

### Acceptance

- [x] Wish control lives in parent HUD; toddlers don’t open it by accident
- [x] Catalog tweaks (“walls pink”, “more ducks”, “add birds”) work without an API key
- [x] Novel wishes escalate to Grok when `XAI_API_KEY` is set
- [x] Live play updates via `applySpec` (no full page reload)
- [x] Stateless `POST /api/wish` + client offline catalog fallback
- [x] localStorage restore of last wished spec per pack id
- [x] Spell beat (“Granting your wish…”) + charming offline invent (no sad circle-face)
- [x] Wish jar: seeded free credits; novel creations spend; tweaks unlimited/free
- [x] Spec-in-URL share + copy link after a wish
- [x] Imaginative chips alongside catalog chips
- [x] Undo / short wish history in the Wish panel
- [ ] Landing describe-to-play
- [ ] Real credit-pack checkout (Stripe/LemonSqueezy)

### Non-goals

- Redesigning Studio UX for customers
- Accounts
- Phone layout redesign
- Metering the toddler mash loop

---

## Next build priorities

1. Real credit-pack checkout behind the parent gate (jar metaphor already in place)
2. Landing describe-to-play (template pick, then Wish for co-creation)
3. Optional voice input (parent is already saying the wish aloud)
4. Keep polishing generative quality (SVG / behaviors) — this is the soul to fund
5. Tip-jar garnish only if it doesn’t dilute the wish-jar story

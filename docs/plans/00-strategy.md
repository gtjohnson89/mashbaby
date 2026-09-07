# 00 — Strategy: decisions already made

Context for the engineer. Read once, then build. These are settled; do not
redesign them mid-phase.

## What the product is

A parent and a 1–3 year old sit at a laptop. The kid mashes the keyboard and
things happen. The parent holds ★ and makes a **wish** out loud with the kid
("more ducks", "a friendly monster", "turn it into space") and the world
transforms. **That shared spell is the product.** Toddler mash is the safe
substrate that makes it playable at ages 1–3.

## Three problems this plan fixes

### 1. The credit model doesn't work → replace with a one-time unlock

The old plan was "credit packs for novel creations." It fails for three reasons:

- **Unenforceable.** Credits live in `localStorage` (`mash:wishCredits`). Clearing
  site data refills them. The primary revenue mechanism is opt-out by design.
- **Backwards.** It meters the wow moment — the exact thing that converts a
  parent — while toddlers are relentlessly repetitive and want the *same* thing
  40 times.
- **Wrong metric.** Credits bill per-creation. Value delivered is per-session
  peace. Parents pay for "Tuesday 5pm is handled," not for N generations.

**Decision:** one-time **family unlock**, $29–39, via a Stripe Payment Link →
license key → pasted into the parent panel → validated server-side as a signed
token, cached in `localStorage`. No accounts, no wallet, no subscription
plumbing. Free tier keeps the 5 curated packs, unlimited catalog tweaks, and
~3 lifetime novel creations (enough to feel the magic once).

The **wish jar UI metaphor may stay** — it's charming. It just gets backed by an
unlock check instead of a decrementing local balance. See phase 05.

### 2. Nothing persists → private-link saves

The most valuable object the product creates is *"the game me and my kid made."*
Today it lives in `localStorage` plus a `?wish=` URL the parent must remember to
copy. So it evaporates, which kills both the return visit and the only free
acquisition channel (a parent texting "look what we made").

**Decision:** server-side spec storage under a random slug
(`/g/purple-dino-party`) plus an "Our Games" shelf on the dashboard.

**This is NOT a community library.** Links are unlisted, non-browsable, no feed,
no discovery, no search. Hosted browsable UGC aimed at toddlers is a moderation
liability and stays permanently out of scope. The distinction is: private-link
persistence = in scope; discoverable gallery = out. See phase 04.

### 3. Generation can't deliver the promise → parts kit, not SVG authoring

Today `grok.py` can only recolor the theme, change weights/counts, and attach
one LLM-authored SVG to one of five existing behaviors. So "turn it into space"
yields a purple wall and a floating blob.

Two root causes:

- **Magic lives in motion, not sprites.** A perfect unicorn SVG bound to
  `drop_ready` is a falling sticker. A crude one that gallops is a unicorn.
  Toddlers read *movement* as alive.
- **Asking an LLM for SVG is the wrong job.** It's ~400 output tokens, slow, and
  quality is a coin flip — sometimes scary, sometimes malformed.

**Decision — the core technical bet of this plan:** stop banking whole games and
stop asking for SVG. Bank **orthogonal slots** and demote the model from author
to **picker**. It returns ids and a few numbers:

```json
{"body":"blob","color":"#7bc96f","eyes":"googly","extras":["horns","wings"]}
```

~30 tokens instead of ~400. And the result is *always* cute and on-brand,
because a human authored the parts.

Combinatorics do the work: 10 backdrops × ~20 palettes × ~15 behaviors ×
(5 bodies × 5 eyes × 10 extras, ≤3 at a time) is effectively unbounded from a
bank authorable in days. **"Everything we just said" is a recombination problem,
not a generation problem.**

Where each slot gets built:

| Slot | What it controls | Phase |
|---|---|---|
| Parts kit | what a creature looks like | 02 |
| Palettes | color and mood | 02 |
| Behaviors | how it moves (5 → 15) | 07 |
| Backdrops | what world it's in (6 → 10) | 08 |

Backdrops are last on purpose: they are the most art-heavy slot and the least
universal. Motion applies to *every* creature wish; a new world applies only to
"turn it into X" wishes. Phase 08 also parameterizes the existing scenes so
their furniture can be hidden — which fixes the immersion problem far more
cheaply than authoring worlds.

## The token strategy, in order of leverage

1. **Router first (free).** `patches.classify_tweak` already resolves most
   wishes with zero tokens. Widen it. Every wish caught here is instant and free.
2. **Parts kit (10× cheaper output).** Enums instead of SVG.
3. **Spellbook cache (free after first).** Normalize wish text, cache the
   resulting patch server-side. "unicorn", "dragon", "digger", "kitty" will be
   most of real volume. First parent pays; everyone after gets it instantly.
4. **Pre-seed ~200 wishes offline.** Batch, once, cheap. Day one, the
   overwhelming majority of wishes never touch the LLM. You pay only for the
   genuine long tail, and the bank self-populates from real demand.
5. **Cache the system prompt.** It is fully static → cacheable, which removes
   most input cost.
6. **Then drop to a smaller/faster model.** Legitimate *because* the task became
   "pick from enums." This is not just cheaper — **latency is a feature.** With a
   toddler in your lap, six seconds is an eternity. Snappier spell = more magic.

## Positioning (affects copy, not code)

The calm mode, mute, session timer, and gentle wind-down already built are not
"parent polish" — they are **the marketing**. Parents of 1–3s are the most
screen-time-guilty demographic alive.

> "The screen time you don't feel bad about — 10-minute sessions, no ads, ends
> gently on its own."

Nothing else in the category leads with *ending* the session. Use this framing in
landing copy and the Stripe product description.

## Explicitly still out of scope

- Multi-user accounts, sync, multiplayer
- Ads targeting kids
- Browsable/discoverable library of user games
- Public "author a game" Studio as the customer shape (Studio stays private)
- Phone-native apps
- Subscription billing

## Task: reconcile `docs/PRODUCT.md`

`docs/PRODUCT.md` still describes credit packs as the primary model and lists
persistence as `localStorage` + URL only. It now contradicts this plan.

**Do this as part of phase 05, not before** (so the doc changes when the code
does):

- Monetization section: replace credit packs with the one-time family unlock.
  Keep "tweaks stay free forever." Keep tip jar as garnish-only.
- "Explicitly out": keep the community-library exclusion, and add a clarifying
  line that private unlisted links are in scope.
- Build status: mark "Real credit-pack checkout" as superseded by the unlock.
- Next priorities: reorder to match this plan's phase order.

Leave the north star and audience sections alone — they are correct.

# 05 — One-time family unlock (Stripe + license key)

**Requires phase 01** (limits infrastructure is reused for the free tier).

## Why

See [00-strategy.md](00-strategy.md) §1. The credit model is unenforceable
(`localStorage` balance) and prices the wrong thing. Replace it with a one-time
**family unlock**.

## The model

| Tier | Gets |
|---|---|
| **Free** | 5 curated packs, unlimited catalog tweaks/palettes, **3 lifetime novel creations** |
| **Unlocked** ($29–39 once) | Unlimited novel creations, saving to Our Games |

Deliberate choices:
- **Tweaks and palettes stay free forever.** They are the reliability floor.
- **3 lifetime creations, not 3/day.** Enough to feel the magic once, not enough
  to live on. The magic *is* the sales pitch.
- **One-time, not subscription.** Converts far better to guilt-prone parents of
  1–3s, and needs no billing lifecycle, dunning, or cancellation flow.
- **The free counter stays in `localStorage`** and is therefore resettable. That
  is *fine* — it's a soft trial, not the revenue mechanism. The real gate is the
  signed key. Do not over-engineer trial enforcement; the daily global LLM budget
  from phase 01 is the actual cost backstop.

## How keys work (no accounts)

1. George creates a **Stripe Payment Link** (dashboard, no code).
2. On payment, a key is generated and shown/emailed to the parent.
3. Parent pastes the key into the parent panel once.
4. Client stores it in `localStorage` and sends it as `X-Mash-License` on wishes.
5. Server validates the signature — **stateless, no DB lookup, no account.**

**Key format:** `MASH-<payload>-<sig>` where payload is short base32 and sig is
an HMAC-SHA256 truncated to 10 base32 chars, keyed by `MASH_LICENSE_SECRET`.

Payload encodes an issue date and a small random nonce. **No personal data in the
key** — no email, no name.

This is intentionally offline-verifiable: no per-request Stripe call, no user
table, honoring the no-accounts constraint.

## Files

| File | Action |
|------|--------|
| `server/app/license.py` | **create** — mint + verify |
| `server/scripts/mint_license.py` | **create** — CLI to issue keys |
| `server/app/main.py` | modify — read header, gate novel wishes |
| `engine/wishes.js` | modify — replace jar credits with unlock state |
| `engine/styles.css` | modify — unlock panel styling |
| `docs/PRODUCT.md` | modify — reconcile monetization (see 00-strategy) |
| `server/.env.example` | modify — `MASH_LICENSE_SECRET` |

## Step 1 — `server/app/license.py`

```python
def mint(*, issued: date | None = None) -> str
    """Generate a key. issued defaults to today (UTC)."""

def verify(key: str | None) -> bool
    """Constant-time signature check. False on None/garbage/bad sig. Never raises."""
```

Requirements:
- `MASH_LICENSE_SECRET` from env. **If unset in production, `verify` must return
  `False` for everything** — never fail open. For local dev, allow a documented
  default secret and log a loud warning at startup.
- Use `hmac.compare_digest` for the comparison — not `==`.
- Normalize input before verifying: uppercase, strip whitespace and stray dashes,
  so a parent retyping a key from an email still works. Be generous here; a
  rejected valid key is a support ticket and a refund.
- Keys do not expire. It's a one-time purchase.

## Step 2 — `server/scripts/mint_license.py`

```
python3 -m server.scripts.mint_license [--count N]
```
Prints N keys, one per line. George runs this after a Stripe payment and pastes
the key to the customer.

**Manual fulfilment is correct at this stage** — at low volume it costs minutes
and saves building a webhook, an email pipeline, and their failure modes. Add a
note in the script docstring: *automate with a Stripe webhook only once volume
justifies it.*

## Step 3 — `server/app/main.py`

Accept the header on wish endpoints:

```python
from fastapi import Header
...
async def wish_patch(request: Request, body: WishBody,
                     x_mash_license: str | None = Header(default=None)):
    licensed = license.verify(x_mash_license)
```

Gate only the **novel** path:

- Cache hits (`path: spellbook`) and deterministic intents: **always allowed**,
  licensed or not. They cost nothing.
- Uncached novel wish + unlicensed: still serve it, but include
  `"free_novel": True` in the response so the client can count it. The **client**
  owns the trial counter; the server does not track individuals (no accounts).
- Uncached novel wish + licensed: skip the per-IP `llm_window` limit (paying
  customers shouldn't be throttled), but **still respect the global daily
  budget** — that's the cost backstop.

Add to the response: `{"licensed": licensed, "free_novel": not licensed}`.

Ensure `X-Mash-License` is in the CORS `allow_headers` list from phase 01.

## Step 4 — `engine/wishes.js`

Replace the credit jar mechanics. Keep the jar **visual** — it's charming — but
back it with unlock state.

- New keys: `mash:license` (the key string), `mash:freeNovelUsed` (integer).
- Constant `FREE_NOVEL_LIMIT = 3`.
- Remove `SEED_CREDITS` / `CREDITS_KEY` decrementing logic and `spendCredit`.
  Keep the exported names as no-op shims if anything else references them, then
  delete once confirmed unused (`grep -rn "spendCredit\|wishCredits" engine/ studio/`).
- Send `X-Mash-License` on every `/api/wish` call when present.
- **Unlicensed:** jar shows remaining free creations (`3 → 0`). At zero, novel
  wishes are paused; the panel shows an unlock prompt. **Free tweaks and palettes
  keep working** — say so plainly in the copy.
- **Licensed:** jar renders as an "unlimited" state (e.g. `★ Unlimited`), never a
  countdown.
- **Never count a degraded result.** If `turn_usage.path` is
  `rate_limited_offline` or `offline_freewheel`, do not increment
  `freeNovelUsed`. Charging for degraded output causes refunds.
- Cache hits (`path: spellbook`) **do** count against the free trial — the parent
  received a novel creation. Consistent pricing beats clever pricing.

**Unlock UI** (inside the parent-gated wish panel, never kid-facing):
- Short line: what unlock gets you, one-time price.
- A "Get the family unlock" link to the Stripe Payment Link
  (`MASH_STRIPE_LINK`, injected via `/api/catalog` or a small `/api/config`).
- A text input to paste a key + "Unlock" button.
- Validate by calling `/api/wish` with a trivial tweak and reading `licensed`,
  or add a tiny `POST /api/license/check`. Prefer the explicit endpoint — clearer
  errors for a parent who mistyped.
- On success: warm confirmation, jar switches to unlimited.
- On failure: kind, actionable message. Never "invalid token."

## Step 5 — `docs/PRODUCT.md`

Apply the edits described in [00-strategy.md](00-strategy.md) §"Task: reconcile".
Do it in this phase so the doc and code change together.

## Do not

- Do not build a Stripe webhook, customer table, or email sender in this phase.
- Do not put email or any personal data in the key.
- Do not fail open when `MASH_LICENSE_SECRET` is unset in production.
- Do not gate catalog tweaks, palettes, spellbook hits, or the mash loop.
- Do not show purchase UI outside the hold-gated parent panel. **Never sell to a
  toddler.**
- Do not count degraded/offline results against the free trial.
- Do not add subscription or recurring billing.

## Verify

```bash
# 1. Mint and verify round-trip
export MASH_LICENSE_SECRET=test-secret-do-not-ship
python3 -m server.scripts.mint_license --count 2
python3 -c "
import os; os.environ['MASH_LICENSE_SECRET']='test-secret-do-not-ship'
from server.app import license
k = license.mint()
print('mint:', k)
print('valid:', license.verify(k))
print('tampered:', license.verify(k[:-1]+'X'))
print('garbage:', license.verify('MASH-nope-nope'))
print('none:', license.verify(None))
print('lowercase+spaces:', license.verify('  ' + k.lower() + ' '))
"
# expect: valid True; tampered/garbage/none False; lowercase+spaces True
```

```bash
# 2. Wrong secret rejects a valid key
# Mint with secret A, verify under secret B -> False
```

```bash
# 3. Unset secret fails closed
# Unset MASH_LICENSE_SECRET in a production-mode run; verify() -> False for a
# previously valid key.
```

```bash
# 4. Licensed request reports licensed
curl -s -X POST http://127.0.0.1:8787/api/wish \
  -H 'Content-Type: application/json' -H "X-Mash-License: $KEY" \
  -d "{\"spec\": $(cat specs/babies-eating-cookies.json), \"text\": \"pink walls\"}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['licensed'])"
# expect: True   (and False with the header omitted)
```

```bash
# 5. Free tweaks work unlicensed and are never gated
# With mash:freeNovelUsed = 3 and no license: "pink walls" must still apply.
```

**Browser QA.**
- [ ] Fresh profile: jar shows 3 free creations
- [ ] Three novel wishes decrement to 0; the 4th is paused with an unlock prompt
- [ ] Free tweaks and palettes still work at 0
- [ ] A degraded/offline result does not decrement the counter
- [ ] Pasting a valid key switches the jar to unlimited and unpauses novel wishes
- [ ] A mistyped key gives a kind, specific error
- [ ] No purchase UI is reachable without the ~2s parent hold
- [ ] `grep -rn "spendCredit\|wishCredits" engine/ studio/` returns nothing stale

## Done when

- [ ] All five Verify blocks pass
- [ ] Browser QA checklist complete
- [ ] Fails closed with no secret; `hmac.compare_digest` used
- [ ] `docs/PRODUCT.md` reconciled
- [ ] Stripe Payment Link created and wired (link itself is config, not code)

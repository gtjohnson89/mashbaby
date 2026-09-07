# 03 — Spellbook: cache + pre-seed common wishes

**Requires phase 02** (the cache stores parts-based patches).

## Why

Toddler wishes are extremely repetitive across families. "unicorn", "dragon",
"kitty", "digger", "truck", "rainbow" will be most of real volume.

Today every one of those is a fresh LLM call. That is money and — worse —
**latency**. With a toddler in your lap, six seconds is an eternity.

The spellbook makes the common case **free and instant**:

1. Normalize the wish text.
2. Look it up. Hit ⇒ apply the stored patch, zero tokens, ~5ms.
3. Miss ⇒ call the LLM, then store the result for everyone after.

Then **pre-seed ~200 known wishes offline**, once. Day one, most wishes never
touch the LLM. You pay only for the genuine long tail, and the book
self-populates from real demand.

## Key design decision: store patches, not specs

A cached entry must apply to *any* base spec — the same "unicorn" wish has to
work on the cookies game and the pond game. So the spellbook stores the
**patch** (what `grok.invent_or_patch` produces internally), not a finished spec.

This means refactoring `grok.py` to expose the patch separately from its
application. Do that first (step 1).

## Files

| File | Action |
|------|--------|
| `server/app/grok.py` | modify — split patch generation from application |
| `server/app/spellbook.py` | **create** — normalize, lookup, store |
| `server/app/db.py` | modify — `spellbook` table |
| `server/app/main.py` | modify — check book before LLM |
| `server/data/top_wishes.txt` | **create** — ~200 seed wishes |
| `server/scripts/seed_spellbook.py` | **create** — batch seeder |
| `server/app/limits.py` | modify — don't bill cache hits |

## Step 1 — refactor `server/app/grok.py`

Extract the patch-producing part so it can be cached:

```python
async def generate_patch(*, spec, text, history=None) -> tuple[dict, dict, str]:
    """Returns (patch, usage, note). Does NOT apply the patch."""

async def invent_or_patch(*, spec, text, history=None) -> tuple[dict, dict, str]:
    """Unchanged public signature: (new_spec, usage, note).
    Now = generate_patch(...) then expand palette + apply_json_patch."""
```

Put the palette expansion and `apply_json_patch` in one place so the cache-hit
path and the LLM path apply patches **identically**. Name it:

```python
def apply_patch_with_palette(spec: dict, patch: dict) -> dict
```

Do the same split for the offline composer:
`_offline_freewheel_patch(text) -> (patch, note)`, with `_offline_freewheel`
wrapping it. Phase 01's degrade path keeps calling `_offline_freewheel`.

## Step 2 — `server/app/db.py`

Add:

```python
class Spell(Base):
    __tablename__ = "spellbook"
    key: Mapped[str] = mapped_column(String(120), primary_key=True)  # normalized
    raw_text: Mapped[str] = mapped_column(Text)        # first real phrasing seen
    patch_json: Mapped[str] = mapped_column(Text)
    note: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(24))    # grok | offline | seed | hand
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    hit_count: Mapped[int] = mapped_column(Integer, default=0)
```

Helpers:
```python
def spell_get(key: str) -> dict | None      # also increments hit_count
def spell_put(key, raw_text, patch, note, source) -> None   # upsert
def spell_stats() -> dict                   # {"count": n, "top": [(key, hits), ...]}
```

`init_db()` already calls `create_all`, so the table appears automatically. No
migration needed (SQLite, additive).

## Step 3 — `server/app/spellbook.py`

```python
FILLER = {"a","an","the","some","add","make","put","can","we","have","i","want",
          "please","get","give","us","me","my","with","to","in","into","turn","it",
          "there","be","of","and","for","lets","let's","how","about","would","like"}

def normalize(text: str) -> str:
    """lowercase -> strip punctuation -> drop filler -> collapse whitespace.
    Returns "" if nothing meaningful remains."""
```

- Lowercase; replace non-alphanumeric with spaces; split.
- Drop `FILLER` tokens **and** drop plural `s` only via a small explicit map
  (`ducks->duck`, `mice->mouse`, `babies->baby`). **Do not write a stemmer** — it
  will mangle words like "grass".
- Rejoin with single spaces. Truncate to 120 chars.
- `""` ⇒ caller must skip the cache (never store an empty key).

```python
def lookup(text: str) -> dict | None    # {"patch":..., "note":..., "source":...}
def remember(text: str, patch: dict, note: str, source: str) -> None
```

`remember` guards:
- Skip empty normalized keys.
- Skip if `patch` is empty/falsy.
- **Skip patches that carry raw `svg`** in any `customEntities` entry — never
  cache un-vetted SVG for redistribution to other families.
- Skip if `json.dumps(patch)` exceeds ~8 KB.
- Never overwrite a `source="hand"` entry (those are George's curated overrides).

## Step 4 — `server/app/main.py`

In `wish_patch`, the `freewheel` branch becomes:

```
if intent == "freewheel":
    cached = spellbook.lookup(body.text)
    if cached:
        new_spec = grok.apply_patch_with_palette(body.spec, cached["patch"])
        note = cached["note"]
        usage = {..zeros.., "path": "spellbook", "novel": True}
    else:
        # phase 01 limit checks HERE (only on a real miss)
        patch, usage, note = await grok.generate_patch(spec=body.spec, text=body.text)
        new_spec = grok.apply_patch_with_palette(body.spec, patch)
        spellbook.remember(body.text, patch, note, source="grok")
```

Two important consequences:

- **Order matters:** check the cache *before* the phase-01 rate-limit and budget
  checks. A cache hit costs nothing, so it must not consume anyone's quota or be
  refused when the budget is exhausted. Fix `limits.py` accordingly if the checks
  were written earlier in the handler.
- **Cache hits are still `novel: True`** for jar/unlock purposes. The parent got
  a novel creation; whether you paid a vendor is your business, not theirs.
  Consistent pricing beats clever pricing.

Also add `spell_stats()` to `/api/health` output as `spellbook_count`.

## Step 5 — `server/data/top_wishes.txt`

One wish per line, `#` for comments. ~200 entries. Draw from what 1–3 year olds
actually ask for:

- **Animals:** kitty, puppy, bunny, bear, elephant, monkey, penguin, lion, tiger,
  giraffe, zebra, cow, pig, sheep, horse, duck, chicken, frog, fish, shark,
  whale, dolphin, turtle, snake, owl, bee, butterfly, ladybug, spider, crab,
  dinosaur, dragon, unicorn, mermaid
- **Vehicles:** truck, fire truck, digger, excavator, train, bus, car, race car,
  tractor, airplane, helicopter, rocket, boat, garbage truck, police car,
  ambulance, motorcycle
- **Characters:** robot, princess, pirate, wizard, superhero, fairy, ghost,
  friendly monster, snowman, clown
- **Food:** cake, cupcake, pizza, banana, apple, strawberry, donut, candy,
  lollipop, watermelon, cheese, spaghetti
- **Nature/weather:** rainbow, flower, tree, sun, moon, stars, snow, rain,
  clouds, volcano
- **Worlds** (palette-heavy): space, underwater, jungle, farm, beach, castle,
  candy land, dinosaur land, north pole, city
- **Phrasings** to exercise the normalizer: `more ducks`, `a really big cookie`,
  `everything pink`, `make it rainbow`, `turn it into space`, `add a puppy please`

Include natural phrasings, not just nouns — the normalizer must collapse
"can we have a puppy please" and "add a puppy" to the same key.

## Step 6 — `server/scripts/seed_spellbook.py`

CLI batch seeder. Run once before launch, and again whenever the banks grow.

```
python3 -m server.scripts.seed_spellbook [--offline] [--limit N] [--force] [--dry-run]
```

Behavior:
- Read `server/data/top_wishes.txt`, skip blanks and `#` comments.
- For each wish: normalize; skip if already in the book unless `--force`.
- **First run `patches.classify_tweak`.** If the intent is *not* `freewheel`
  (i.e. it's a palette/catalog/theme hit), **skip it** — the deterministic path
  already handles it for free and caching it adds nothing.
- `--offline` ⇒ use `_offline_freewheel_patch` (free, no key). Otherwise call
  `generate_patch` against a neutral base spec.
- **Base spec:** use `catalog.TEMPLATES["blank-room"]["default_spec"]`, so cached
  patches aren't contaminated by another game's theme.
- Sequential with a small delay (~0.5s); no need for concurrency at 200 items.
  Retry each wish up to 2 times on transient error, then log and continue.
- Store with `source="seed"`.
- Print a running tally and a final summary: seeded / skipped / failed, plus
  total tokens spent.
- `--dry-run` prints what it would do without calling anything or writing.

**Run `--offline` first** and eyeball the results on the contact sheet. Only
spend real tokens once the offline output looks right.

## Step 7 — curation escape hatch

Some wishes deserve a hand-tuned answer ("unicorn" should be *great*). Support:

```
python3 -m server.scripts.seed_spellbook --import server/data/hand_spells.json
```

`hand_spells.json`: `{ "<wish text>": { "patch": {...}, "note": "..." } }`,
stored with `source="hand"`. `remember()` must never overwrite these. This is how
George upgrades a specific spell without touching code.

## Do not

- Do not cache anything containing raw `svg`.
- Do not cache deterministic intents (theme/palette/catalog/more) — they're
  already free and instant; caching them only adds staleness.
- Do not let a cache hit consume rate-limit quota or the daily budget.
- Do not write a general-purpose stemmer. Explicit plural map only.
- Do not add Redis or a cache library. SQLite is correct at this scale.
- Do not let seeding be required for the app to run. A cold, empty spellbook must
  behave exactly like today.

## Verify

```bash
# 1. Normalizer collapses phrasings
python3 -c "
from server.app.spellbook import normalize
for t in ['a puppy','add a puppy please','can we have a puppy?','PUPPY!!',
          'more ducks','turn it into space','']:
    print(repr(t), '->', repr(normalize(t)))
"
# expect: first four all -> 'puppy'; '' -> ''
```

```bash
# 2. Offline seed populates the book
python3 -m server.scripts.seed_spellbook --offline --limit 20
curl -s http://127.0.0.1:8787/api/health
# expect: spellbook_count > 0
```

```bash
# 3. Second identical wish is a free instant hit
time curl -s -X POST http://127.0.0.1:8787/api/wish -H 'Content-Type: application/json' \
  -d "{\"spec\": $(cat specs/babies-eating-cookies.json), \"text\": \"a friendly dragon\"}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['turn_usage']['path'], d['turn_usage']['total_tokens'])"
# run TWICE. Second must print: spellbook 0  — and be visibly faster
```

```bash
# 4. Different phrasing hits the same entry
# "add a dragon please" must also return path=spellbook after the above.
```

```bash
# 5. Cache hit works across different base games
# Wish "a friendly dragon" on duck-pond-splash. Confirm the dragon appears AND
# the pond theme is otherwise intact (patch applied cleanly to a different base).
```

```bash
# 6. Cache hits bypass the budget
# Set MASH_LLM_PER_DAY_GLOBAL=0, restart. A cached wish must still return
# path=spellbook with HTTP 200. An UNcached novel wish must degrade to offline.
```

```bash
# 7. SVG patches are never cached
# Hand-craft a patch containing customEntities.x.svg, call remember(), confirm
# lookup() returns None.
```

## Done when

- [ ] All seven Verify commands produce the expected output
- [ ] `top_wishes.txt` has ~200 entries; `--offline` seeding completes clean
- [ ] Repeat wishes report `path: spellbook`, `total_tokens: 0`, and feel instant
- [ ] Cache hits neither consume quota nor are blocked by an exhausted budget
- [ ] An empty spellbook behaves exactly like pre-phase behavior
- [ ] `--dry-run` and `--import` both work

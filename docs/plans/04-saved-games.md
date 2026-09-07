# 04 — Private-link saves + "Our Games" shelf

## Why

The most valuable thing the product makes is *"the game me and my kid made."*
Today it lives in `localStorage` plus a `?wish=` URL the parent must remember to
copy — so it evaporates. That kills the return visit **and** the only free
acquisition channel (a parent texting "look what we made").

## Scope guardrail — read this

This is **private-link persistence**, not a community library.

| In scope | Out of scope (permanently) |
|---|---|
| Random unguessable slug URLs | Browsable index of saved games |
| An "Our Games" shelf built from this device's `localStorage` | Search, feed, discovery, trending |
| Sharing by sending someone a link | Public listing endpoint |
| Server-side spec storage | Comments, likes, profiles, accounts |

Hosted browsable UGC aimed at toddlers is a moderation liability. There must be
**no endpoint that enumerates saved games.** If you add one, this phase is wrong.

## Files

| File | Action |
|------|--------|
| `server/app/db.py` | modify — `saved_games` table |
| `server/app/saves.py` | **create** — slug generation, save/load |
| `server/app/main.py` | modify — `POST /api/save`, `GET /api/g/{slug}`, `GET /g/{slug}` |
| `engine/wishes.js` | modify — "Save" button, prefer slug over `?wish=` |
| `engine/play.html` | modify — load a spec from `?g=<slug>` |
| `index.html` | modify — "Our Games" shelf |
| `styles.css` | modify — shelf styling |

## Step 1 — `server/app/db.py`

```python
class SavedGame(Base):
    __tablename__ = "saved_games"
    slug: Mapped[str] = mapped_column(String(64), primary_key=True)
    spec_json: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    view_count: Mapped[int] = mapped_column(Integer, default=0)
```

Helpers: `save_game(slug, spec, title)`, `load_game(slug)` (bumps `view_count`
and `last_seen_at`), `delete_game(slug)`.

## Step 2 — `server/app/saves.py`

**Slug format:** human-readable but unguessable —
`<adjective>-<noun>-<4 hex>`, e.g. `purple-dino-a3f9`.

```python
ADJECTIVES = [...]   # ~40 toddler-friendly: purple, giggly, sleepy, bouncy...
NOUNS = [...]        # ~40: dino, duck, cookie, rocket, kitty...

def make_slug() -> str
    """secrets.choice for words + secrets.token_hex(2). Retry on collision (max 5)."""
```

The 4 hex chars are what make it unguessable — **use `secrets`, never `random`**.
65536 × 1600 combinations is ample, and the words keep it shareable out loud.

```python
def save(spec: dict, license_ok: bool = True) -> dict   # {"slug":..., "url":...}
def load(slug: str) -> dict | None
```

Guards in `save`:
- Reject specs over `MASH_MAX_SPEC_BYTES` (reuse `limits.spec_too_big`).
- Derive `title` from `spec.get("title")`, clamp to 120 chars, strip control chars.
- **Sanitize before storing.** Never persist a spec you wouldn't serve. Reject
  any `customEntities` entry carrying raw `svg` that fails phase 02's blocklist.

Rate limit saves per IP (reuse phase 01's `SlidingWindow`, e.g. 30/hour) — this
endpoint writes to disk and is otherwise free storage for anyone.

## Step 3 — `server/app/main.py`

```python
@app.post("/api/save")     # body: {"spec": {...}} -> {"slug","url"}
@app.get("/api/g/{slug}")  # -> {"spec": {...}, "title": ...} | 404
@app.get("/g/{slug}")      # -> FileResponse(engine/play.html)
```

`/g/{slug}` serves `play.html`, which reads the slug client-side (same trick as
the existing `/play/{session_id}` route). Validate the slug against
`^[a-z]+-[a-z]+-[0-9a-f]{4}$` before touching the DB.

404 for a missing slug must **not** be a dead end — see step 4.

## Step 4 — `engine/play.html` + `engine/wishes.js`

**Loading.** Spec resolution priority:
1. `?g=<slug>` or a `/g/<slug>` path → `GET /api/g/{slug}`
2. `?wish=<token>` (existing base64 spec-in-URL — keep working)
3. `?spec=<path>` (existing)
4. persisted `localStorage` spec for that pack id
5. bundled fallback

If a slug 404s or errors, **fall through to the cookies fallback and still
play.** Never show an error screen (project invariant).

**Saving.** In the wish panel, next to the existing "Copy link":
- Add a **Save** button. `POST /api/save` with the current spec → get slug.
- Record it in `localStorage` under `mash:savedGames` as an array of
  `{slug, title, savedAt, packId}`, newest first, capped at 30.
- Change "Copy link" to prefer the slug URL (`/g/<slug>`) once saved — it's much
  shorter and more shareable than a base64 spec blob. Keep `?wish=` as the
  offline fallback when the save request fails.
- Show a warm confirmation: `"Saved to Our Games!"`

Saving must work **offline-degraded**: if `POST /api/save` fails, fall back to
the existing `?wish=` copy-link behavior and say nothing about servers.

## Step 5 — `index.html` + `styles.css`

Add an **"Our Games"** section above the built-in tiles, rendered from
`localStorage.mash:savedGames`:

- Hidden entirely when the list is empty (no empty-state clutter for new users).
- Each entry is a tile linking to `/g/<slug>`, styled like the existing
  `.game-btn` tiles so it feels native.
- Show the title and a relative date ("made 2 days ago").
- Include a small remove control — **parent-safe**: require a ~1s hold, matching
  the Exit/Wish pattern, so a toddler can't delete the shelf by mashing.
  Removing only drops the local entry; it does not delete server-side.
- Tiles must be keyboard-reachable and big enough to tap.

## Do not

- Do not add any endpoint that lists or enumerates saved games.
- Do not use `random` for slugs — `secrets` only.
- Do not require a save to play. Everything works unsaved.
- Do not delete server rows from the client.
- Do not break `?wish=` links — they are already in the wild.
- Do not add a tap-only delete control.

## Verify

```bash
# 1. Save returns a well-formed slug
SLUG=$(curl -s -X POST http://127.0.0.1:8787/api/save -H 'Content-Type: application/json' \
  -d "{\"spec\": $(cat specs/balloon-pop-party.json)}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['slug'])")
echo "$SLUG"
echo "$SLUG" | grep -Eq '^[a-z]+-[a-z]+-[0-9a-f]{4}$' && echo "slug format OK"
```

```bash
# 2. Round-trips
curl -s "http://127.0.0.1:8787/api/g/$SLUG" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['title'], len(d['spec']['onMash']))"
# expect: Balloon Pop Party 1
```

```bash
# 3. Slugs are unguessable — two saves of the same spec differ
# Save twice, confirm different slugs.
```

```bash
# 4. Missing slug is playable, not an error
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/api/g/nope-nope-0000   # 404
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/g/nope-nope-0000       # 200 (serves play.html)
# Then load /g/nope-nope-0000 in a browser: must play the fallback game, no error screen.
```

```bash
# 5. No enumeration endpoint exists
curl -s http://127.0.0.1:8787/openapi.json \
  | python3 -c "import json,sys; print([p for p in json.load(sys.stdin)['paths'] if 'save' in p or '/g' in p])"
# expect exactly: ['/api/save', '/api/g/{slug}', '/g/{slug}']
```

**Browser QA.**
- [ ] Wish → Save → confirmation appears; Copy link yields a short `/g/...` URL
- [ ] Open that URL in a fresh private window: the wished game loads correctly
- [ ] Dashboard shows "Our Games" with the new tile; hidden again once removed
- [ ] Remove requires a hold; a rapid mash does not delete anything
- [ ] With the server stopped, Save degrades to `?wish=` copy-link silently

## Done when

- [ ] All five Verify commands pass
- [ ] Browser QA checklist complete
- [ ] No listing endpoint; slugs use `secrets`
- [ ] Old `?wish=` links still play
- [ ] Shelf hidden when empty

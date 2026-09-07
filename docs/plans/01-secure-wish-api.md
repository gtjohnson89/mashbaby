# 01 — Secure `/api/wish` (blocks hosting)

## Why

Right now, on a public host, anyone can bill George's xAI account.

- `server/app/main.py:22` sets `allow_origins=["*"]`.
- `POST /api/wish` has no auth, no rate limit, and no request-size cap.
- `body.spec` is an unvalidated free-form `dict[str, Any]`.
- A `freewheel` intent escalates straight to `grok.invent_or_patch`, which spends
  real money using a server-side key.

A trivial `while true; do curl ...; done` is an unbounded bill. **This phase must
land before the app is exposed to the internet.**

## Design

Three independent layers. All limits come from env vars with safe defaults so
local dev is unaffected.

1. **CORS allowlist** — stop other sites from driving the API from a browser.
2. **Per-IP rate limits** — two separate buckets, because the two paths have wildly
   different costs:
   - *cheap bucket*: all `/api/wish` calls (deterministic catalog work) — generous.
   - *expensive bucket*: only calls that escalate to the LLM — tight.
3. **Global daily LLM budget** — a hard ceiling on total spend per UTC day, so even
   a distributed flood can't run the bill past a known number.

Plus input hardening: cap spec size and reject junk before it reaches the LLM.

**Fail soft, never scary.** When a limit trips, the game keeps working with
catalog tweaks. The parent sees a warm message, never a stack trace and never a
broken screen. Toddler play must never be interrupted by a 429.

## Files

| File | Action |
|------|--------|
| `server/app/limits.py` | **create** — buckets, budget, env config |
| `server/app/main.py` | modify — CORS, wire limits into `/api/wish` |
| `engine/wishes.js` | modify — handle 429 gracefully |
| `server/.env.example` | **create** — document every env var |
| `docs/plans/01-secure-wish-api.md` | this file |

## Step 1 — `server/app/limits.py` (new)

In-process, dependency-free (no Redis). Single-process deployment assumption is
fine at this scale; note it in a docstring.

```python
"""Rate limits + LLM spend ceiling for public hosting. In-process, single-worker."""
```

Implement:

```python
def _env_int(name: str, default: int) -> int
```
Parse an int from env, falling back to `default` on missing/garbage.

**Config, read at import:**

| Env var | Default | Meaning |
|---|---|---|
| `MASH_ALLOWED_ORIGINS` | `""` | Comma-separated. Empty ⇒ use dev defaults (see step 2) |
| `MASH_WISH_PER_HOUR` | `120` | Per-IP `/api/wish` calls per hour (cheap bucket) |
| `MASH_LLM_PER_HOUR` | `12` | Per-IP LLM escalations per hour (expensive bucket) |
| `MASH_LLM_PER_DAY_GLOBAL` | `500` | Total LLM calls per UTC day, all users |
| `MASH_MAX_SPEC_BYTES` | `24576` | Reject specs larger than this |

**Sliding-window counter** — keep it simple and readable:

```python
class SlidingWindow:
    """Per-key timestamp deque, trimmed to `window_seconds`."""
    def __init__(self, limit: int, window_seconds: int) -> None
    def check(self, key: str) -> bool:
        """True if allowed. Records the hit. False if over limit (records nothing)."""
    def retry_after(self, key: str) -> int:
        """Seconds until the oldest hit expires. For the Retry-After header."""
```

- Store `dict[str, collections.deque[float]]` using `time.monotonic()`.
- On each `check`, `popleft()` while the oldest entry is older than the window.
- **Memory guard:** if the dict exceeds 10_000 keys, drop keys whose deques are
  empty. Do this inside `check` so it self-maintains; an unbounded dict keyed by
  attacker-controlled IPs is itself a DoS.

**Global daily budget:**

```python
class DailyBudget:
    """Global LLM call ceiling, resets at UTC midnight."""
    def __init__(self, limit: int) -> None
    def check_and_spend(self) -> bool
    def remaining(self) -> int
```
Track `(utc_date, count)`; reset `count` when `datetime.now(timezone.utc).date()`
changes.

**Module-level singletons** (so state is shared across requests):

```python
wish_window = SlidingWindow(WISH_PER_HOUR, 3600)
llm_window  = SlidingWindow(LLM_PER_HOUR, 3600)
llm_budget  = DailyBudget(LLM_PER_DAY_GLOBAL)
```

**Client IP helper:**

```python
def client_ip(request: Request) -> str:
    """Left-most X-Forwarded-For entry when behind a proxy, else request.client.host."""
```
Most PaaS hosts (Fly/Render/Railway) terminate TLS and set `X-Forwarded-For`.
Take the **first** comma-separated entry, `.strip()` it. Fall back to
`request.client.host`, then to `"unknown"`.

**Allowed-origins helper:**

```python
def allowed_origins() -> list[str]
```
Split `MASH_ALLOWED_ORIGINS` on commas, strip, drop empties. If the result is
empty, return the dev defaults:
`["http://127.0.0.1:8787", "http://localhost:8787", "http://127.0.0.1:8765", "http://localhost:8765"]`

**Spec size check:**

```python
def spec_too_big(spec: dict) -> bool:
    """len(json.dumps(spec)) > MAX_SPEC_BYTES. Return True on serialization failure."""
```

## Step 2 — `server/app/main.py`

**CORS** — replace the wildcard at line ~22:

```python
from .limits import allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Mash-License"],
)
```
`allow_origins=["*"]` must not remain anywhere. (`X-Mash-License` is pre-declared
for phase 05.)

**Bound the request body** — tighten `WishBody`:

```python
class WishBody(BaseModel):
    text: str = Field(min_length=1, max_length=400)   # was 2000
    spec: dict[str, Any]
```
400 chars is far more than any real spoken wish; 2000 was just paying for tokens
you'd never use.

**Rewrite `wish_patch`.** Add `request: Request` as the first parameter (import
`Request` from `fastapi`). Order of checks matters — cheapest first:

```
1. spec_too_big(body.spec)          -> 413, note "That game got too big to wish on."
2. wish_window.check(ip)            -> 429, note (see below), Retry-After header
3. new_spec, intent, usage = apply_tweak(body.spec, body.text)
4. if intent == "freewheel":
       a. llm_window.check(ip) fails  -> DEGRADE (see below)
       b. llm_budget.check_and_spend() fails -> DEGRADE
       c. else: await invent_or_patch(...)
5. notes / response exactly as today
```

**DEGRADE is the important part — do not return an error here.** When an LLM
limit trips, still return HTTP 200 with a playable spec:

- Call `grok._offline_freewheel(body.spec, body.text)` — it already produces a
  charming composed entity with zero tokens. *(Phase 02 replaces this with the
  parts composer; the call site stays the same.)*
- Set `intent = "freewheel"`, `novel = True`.
- Set `usage["path"] = "rate_limited_offline"` so it's visible in logs.
- Set the note to a warm, non-technical line:
  `"The wish wizard needs a little rest — here's some offline magic! Try again in a bit."`

Rationale: a 429 mid-play means a toddler is staring at a frozen screen. Offline
magic means they never know.

For the hard 429 in step 2 (cheap bucket, i.e. genuine flooding), respond with:

```python
raise HTTPException(
    status_code=429,
    detail="Too many wishes right now — take a mash break and try again soon.",
    headers={"Retry-After": str(wish_window.retry_after(ip))},
)
```

**Also protect the session routes.** `/api/session/{id}/tweak` and
`/api/session/{id}/prompt` reach the same LLM. Studio is private, but the routes
are public once hosted. Apply `llm_window` + `llm_budget` to the `freewheel`
branch of `tweak_session` the same way. `prompt_session` is deterministic
(`build_from_prompt`) — cheap bucket only.

**Add budget visibility** to `/api/health`:

```python
{"status": "ok", "llm_budget_remaining": llm_budget.remaining()}
```
Useful for a hosting dashboard and for the Verify step below.

## Step 3 — `engine/wishes.js`

`requestWish` (around line 187) currently `fetch`es `/api/wish` and falls back to
the offline matcher on throw. Make the failure modes explicit:

- **On `res.status === 429`:** do not throw. Apply the offline matcher
  (`applyOffline`) and surface the server's `detail` string via
  `showNote(..., "warn")`. Play continues.
- **On `res.status === 413`:** same shape, note "That game got too big to wish on."
- **On any non-OK status or network error:** existing offline fallback path.
- **Never spend a jar credit when the server degraded.** Check
  `result.turn_usage.path`; if it is `"rate_limited_offline"` or
  `"offline_freewheel"`, skip `spendCredit()`. Charging for a degraded result is
  the one thing guaranteed to make a parent ask for a refund.

## Step 4 — `server/.env.example` (new)

Document every var with its default and a one-line comment. Include
`XAI_API_KEY`, `XAI_MODEL`, all five `MASH_*` vars from step 1, and a placeholder
`MASH_LICENSE_SECRET` for phase 05. Add a header comment: *"Copy to .env; never
commit real values."*

Confirm `.gitignore` covers `.env` — add it if not.

## Do not

- Do not add Redis, `slowapi`, or any new dependency. Stdlib only.
- Do not rate-limit the mash loop, key handling, or any static asset. **Only the
  wish endpoints.**
- Do not return a 4xx/5xx that leaves the play screen without a spec.
- Do not log full spec bodies or the wish text at INFO — log intent, path, and IP
  only. Wish text is family-personal.
- Do not touch the jar-credit seeding logic; phase 05 replaces it wholesale.

## Verify

Run each and paste real output.

```bash
# 1. Server boots, budget visible
./server/run.sh &
timeout 30 bash -c 'until curl -sf http://127.0.0.1:8787/api/health >/dev/null; do sleep 1; done'
curl -s http://127.0.0.1:8787/api/health
# expect: {"status":"ok","llm_budget_remaining":500}
```

```bash
# 2. CORS is no longer a wildcard
curl -s -D- -o /dev/null http://127.0.0.1:8787/api/health \
  -H "Origin: https://evil.example" | grep -i access-control-allow-origin
# expect: NO wildcard. Either absent, or the dev origin — never "*"
```

```bash
# 3. A free catalog tweak still works and costs nothing
curl -s -X POST http://127.0.0.1:8787/api/wish -H 'Content-Type: application/json' \
  -d "{\"spec\": $(cat specs/babies-eating-cookies.json), \"text\": \"pink walls\"}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['intent'], d['spec']['theme']['wallColor'], d['turn_usage']['path'])"
# expect: theme #ff9ec5 deterministic
```

```bash
# 4. Oversized spec is rejected
python3 -c "
import json,urllib.request
spec={'id':'x','onMash':[{'kind':'star','weight':1}],'junk':'A'*40000}
r=urllib.request.Request('http://127.0.0.1:8787/api/wish',
  data=json.dumps({'spec':spec,'text':'hi'}).encode(),
  headers={'Content-Type':'application/json'})
try: urllib.request.urlopen(r)
except Exception as e: print('status', e.code)
"
# expect: status 413
```

```bash
# 5. LLM bucket degrades instead of erroring.
# Set MASH_LLM_PER_HOUR=1, restart, then send two novel wishes.
# First -> path grok or offline_freewheel. Second -> path rate_limited_offline,
# HTTP 200, and spec.onMash still non-empty.
```

```bash
# 6. Cheap bucket eventually 429s.
# Set MASH_WISH_PER_HOUR=3, restart, loop 5 identical tweak calls.
# Expect three 200s then 429s carrying a Retry-After header.
```

**Browser check.** Load a game, hold ★ ~2s, submit a wish while the LLM bucket is
exhausted. Confirm: the world still changes, a warm note appears, no console
errors, and the jar count does **not** decrement.

## Done when

- [ ] No `allow_origins=["*"]` anywhere in the repo
- [ ] All six Verify commands produce the expected output
- [ ] Exhausted limits degrade to playable offline magic, never a dead screen
- [ ] Degraded results never spend a jar credit
- [ ] `server/.env.example` documents every var; `.env` is gitignored
- [ ] Default env values leave local dev feeling unchanged

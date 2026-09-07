# 06 — Voice wishes ("hold the star and say it")

## Why

The parent is **already saying the wish out loud** to their kid. Typing it is a
downgrade of the exact moment the product exists to create.

Web Speech API (`webkitSpeechRecognition`) is free, on-device in Chrome, and
needs no new dependency. This is the cheapest big-magic feature in the plan, and
a real differentiator: the kid gets to *hear* the spell being cast.

## Design

Additive, never required. Typing must keep working identically — voice is a
second input path onto the same submit.

- Voice UI lives **only inside the hold-gated parent panel** (it is a parent
  feature).
- **Push-to-talk, not always-listening.** Hold the mic button to record, release
  to submit. Never open a hot mic in a room with a child. This is a
  privacy-sensitive product for families; the interaction model should make it
  obvious the mic is only live while held.
- Show the interim transcript live so the parent sees it working — and so the kid
  sees words appear as the parent speaks.
- Feature-detect. No API ⇒ hide the mic entirely, no error, no apology.

## Files

| File | Action |
|------|--------|
| `engine/voice.js` | **create** — `MashVoice` wrapper |
| `engine/play.html` | modify — load `voice.js` before `wishes.js` |
| `engine/wishes.js` | modify — mic button, transcript, submit |
| `engine/styles.css` | modify — mic button + listening state |

## Step 1 — `engine/voice.js`

Standard engine global. Thin wrapper that isolates all vendor quirks:

```js
global.MashVoice = { isSupported, start, stop, isListening };
```

```js
function isSupported()   // !!(window.SpeechRecognition || window.webkitSpeechRecognition)

function start(handlers)
// handlers: { onInterim(text), onFinal(text), onError(kind), onEnd() }
// continuous = false; interimResults = true; lang = navigator.language || "en-US"
// maxAlternatives = 1

function stop()          // idempotent; safe to call when not listening
```

Requirements:
- **Idempotent and re-entrant.** Rapid press/release must not leave a dangling
  recognizer or throw `InvalidStateError`. Guard with an internal `listening`
  flag and always clear it in `onend`.
- Map errors to simple kinds: `"denied"` (permission), `"no-speech"`,
  `"network"`, `"other"`. The caller shows friendly copy per kind.
- **Hard cap ~10s.** Auto-stop via timer so a stuck recognizer can't hold the
  mic open. Clear the timer in `stop` and `onend`.
- Never throw out of `start`/`stop` — call `onError` instead.
- Do not retry automatically on error. One press, one attempt.

## Step 2 — `engine/wishes.js`

Add a mic button beside the wish text input (parent panel only).

**Interaction:**
- `pointerdown` / `touchstart` / `keydown(Space|Enter)` → `MashVoice.start(...)`;
  add a `is-listening` class; show a pulsing indicator.
- `pointerup` / `pointerleave` / `touchend` / `keyup` → `MashVoice.stop()`.
- `onInterim` → write into the wish input (do not submit).
- `onFinal` → write the final transcript, then **auto-submit** the wish through
  the existing submit path. Do not duplicate submit logic — call the same
  function the button uses.
- `onError("denied")` → *"Mic needs permission — you can type your wish instead."*
  and hide the mic for the rest of the session.
- `onError("no-speech")` → *"Didn't catch that — try again!"* Leave input as-is.
- `onEnd` → clear the listening state unconditionally.

**Must-haves:**
- Hide the mic when `!MashVoice.isSupported()`.
- Call `MashVoice.stop()` when the wish panel closes, on Exit, and on
  `visibilitychange` to hidden. A mic left live after the panel closes is a
  serious bug.
- Voice must not bypass any phase-05 gating — it feeds the same submit path, so
  free-trial and unlock rules apply automatically. **Verify this rather than
  assuming it.**
- `aria-label="Speak your wish"`, `aria-pressed` reflecting listening state.

## Step 3 — `engine/styles.css`

- Mic button sized to match existing `.hud__parent-btn` proportions.
- Clear `is-listening` state: soft pulse animation + color shift. Must be
  obvious at a glance that the mic is live.
- Respect `prefers-reduced-motion` — swap the pulse for a static color change.
- Honor calm mode: gentler animation when calm is active.

## Do not

- Do not use continuous/always-on recognition.
- Do not send audio anywhere yourself. Browser-native only — no cloud STT, no
  new dependency, no audio upload.
- Do not store or log transcripts. Wish text is family-personal.
- Do not make voice a prerequisite for anything; typing stays fully functional.
- Do not expose the mic outside the hold-gated parent panel.
- Do not auto-retry after an error.

## Verify

Chrome (or another `webkitSpeechRecognition` browser) is required; the API is not
in Firefox. Note the tested browser and version in your summary.

**Browser QA.**
- [ ] Mic button appears in the wish panel in Chrome
- [ ] Mic button is absent in Firefox, with no console error and no broken layout
- [ ] Hold mic → say "a purple dinosaur" → interim text appears live → release →
      wish auto-submits → a purple dinosaur appears
- [ ] Denying mic permission shows the friendly fallback; typing still works
- [ ] Rapid press/release ×10 leaves no stuck listening state and no console errors
- [ ] Closing the panel mid-recording stops the mic (verify the browser's mic
      indicator goes dark)
- [ ] Switching tabs mid-recording stops the mic
- [ ] With `mash:freeNovelUsed` at the limit, a *voice* novel wish is gated
      exactly like a typed one
- [ ] `prefers-reduced-motion: reduce` disables the pulse
- [ ] Silence for 10s auto-stops cleanly

```bash
# Confirm no transcript logging or audio upload was introduced
grep -rn "console.log" engine/voice.js
grep -rn "transcript" engine/ | grep -i "log\|fetch\|post"
# expect: no transcript logging, no upload
```

## Done when

- [ ] Browser QA checklist complete on Chrome, plus the Firefox absence check
- [ ] No stuck-mic state reachable by any press pattern
- [ ] Voice respects phase-05 gating (explicitly tested)
- [ ] Typing behavior is byte-for-byte unchanged
- [ ] No transcripts logged, stored, or transmitted

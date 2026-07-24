"""xAI Grok adapter — returns JSON patches / customEntity DSL. Charming fallback when no API key."""

from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx

from .catalog import glossary
from .patches import apply_json_patch

XAI_URL = "https://api.x.ai/v1/chat/completions"
DEFAULT_MODEL = os.getenv("XAI_MODEL", "grok-3-mini")


def _api_key() -> str | None:
    return os.getenv("XAI_API_KEY") or os.getenv("GROK_API_KEY")


async def invent_or_patch(
    *,
    spec: dict[str, Any],
    text: str,
    history: list[dict[str, str]] | None = None,
) -> tuple[dict[str, Any], dict[str, Any], str]:
    """
    Ask Grok for a minimal GameSpec patch.
    Returns (new_spec, usage, note).
    """
    key = _api_key()
    if not key:
        return _offline_freewheel(spec, text)

    system = (
        "You edit toddler keyboard-mash games (ages 1–3) described by a GameSpec JSON.\n"
        "The parent just made a WISH with their kid — grant it with delight.\n"
        "Return ONLY valid JSON with this shape:\n"
        '{"patch": { ... partial GameSpec fields ... }, "note": "warm short parent-facing note"}\n'
        "Rules:\n"
        "- Prefer tiny patches that make the wish visible immediately.\n"
        "- Use catalog ids when they fit: "
        f"{json.dumps(glossary())}\n"
        "- For brand-new things, add customEntities with cute SVG (no text labels on the art):\n"
        '{"id": {"role":"spawn|actor|ambient","width":72,"height":72,'
        '"behavior":"drop_ready|bake_ready|float_pop|splash_swim|seek_and_munch|fly_across",'
        '"svg":"<svg viewBox=\\"0 0 72 72\\">...</svg>",'
        '"soundSpawn":"cookieDrop","soundInteract":"munch"}}\n'
        "- SVG must be simple, soft, colorful, readable at 72px. Rounded shapes, friendly eyes if any.\n"
        "- Never put readable text inside the SVG. Never scary, sharp, or realistic.\n"
        "- Never rewrite the whole game unless asked. Never empty onMash.\n"
        "- note should sound like a spell landing, e.g. \"A giggly monster joined the mash!\""
    )

    recent = history[-3:] if history else []
    user_payload = {
        "current_spec": {
            "id": spec.get("id"),
            "title": spec.get("title"),
            "scene": spec.get("scene"),
            "theme": spec.get("theme"),
            "onMash": spec.get("onMash"),
            "actors": spec.get("actors"),
            "ambient": spec.get("ambient"),
            "limits": spec.get("limits"),
            "customEntities": spec.get("customEntities") or {},
        },
        "wish": text,
        "recent_wishes": recent,
    }

    payload = {
        "model": DEFAULT_MODEL,
        "temperature": 0.55,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user_payload)},
        ],
        "response_format": {"type": "json_object"},
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(
            XAI_URL,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=payload,
        )
        res.raise_for_status()
        data = res.json()

    usage_raw = data.get("usage") or {}
    usage = {
        "prompt_tokens": usage_raw.get("prompt_tokens", 0),
        "completion_tokens": usage_raw.get("completion_tokens", 0),
        "total_tokens": usage_raw.get("total_tokens", 0),
        "path": "grok",
        "model": DEFAULT_MODEL,
        "novel": True,
    }

    content = data["choices"][0]["message"]["content"]
    parsed = _parse_json(content)
    patch = parsed.get("patch") or parsed
    note = parsed.get("note") or "Your wish came true!"
    new_spec = apply_json_patch(spec, patch)
    return new_spec, usage, note


def _offline_freewheel(spec: dict[str, Any], text: str) -> tuple[dict[str, Any], dict[str, Any], str]:
    """Charming invent stub when no API key — never the sad labeled circle-face."""
    lower = text.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", lower).strip("-")[:24] or "surprise"
    eid = f"wish_{slug.replace('-', '_')}"[:40]
    color = _pick_color(lower)
    accent = _accent_for(color)
    shape, label = _pick_shape(lower)

    svg = _charming_svg(shape, color, accent)
    behavior = "float_pop" if shape in ("balloon", "star", "moon", "spark") else "drop_ready"
    sound_spawn = "inflate" if behavior == "float_pop" else "cookieDrop"
    sound_hit = "pop" if behavior == "float_pop" else "munch"

    patch = {
        "customEntities": {
            eid: {
                "role": "spawn",
                "width": 72,
                "height": 72,
                "behavior": behavior,
                "svg": svg,
                "soundSpawn": sound_spawn,
                "soundInteract": sound_hit,
            }
        }
    }
    # Theme flourishes for “space” / “rainbow” style wishes
    if any(w in lower for w in ("space", "galaxy", "planet", "moon", "starry")):
        patch["theme"] = {
            "skyTop": "#1a1440",
            "skyBot": "#3a2a6a",
            "wallColor": "#1a1440",
            "wallDotColors": ["#ffe066", "#c49bff"],
        }
        patch.setdefault("ambient", [])
    if "rainbow" in lower:
        patch.setdefault("theme", {})
        patch["theme"].update(
            {
                "wallColor": "#ff9ec5",
                "wallDotColors": ["#ffe066", "#5ab0ff", "#c49bff", "#7bc96f"],
            }
        )

    new_spec = apply_json_patch(spec, patch)
    if "rainbow" in lower or any(w in lower for w in ("space", "galaxy", "planet", "starry")):
        ambient = new_spec.setdefault("ambient", [])
        if not any(a.get("kind") == "sparkles" for a in ambient):
            ambient.append({"kind": "sparkles", "count": 5})

    usage = {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "path": "offline_freewheel",
        "novel": True,
    }
    return new_spec, usage, f"A {label} hopped into the mash! (offline magic — add XAI_API_KEY for richer wishes)"


def _pick_color(lower: str) -> str:
    for name, hex_color in (
        ("green", "#7bc96f"),
        ("blue", "#5ab0ff"),
        ("yellow", "#ffe066"),
        ("purple", "#c49bff"),
        ("lavender", "#d4b0ff"),
        ("orange", "#ff9a5a"),
        ("pink", "#ff9ec5"),
        ("red", "#ff6b6b"),
        ("teal", "#4aa8d8"),
    ):
        if name in lower:
            return hex_color
    # Stable-ish pick from wish text
    palette = ["#ff9ec5", "#c49bff", "#5ab0ff", "#ffe066", "#7bc96f", "#ff9a5a"]
    return palette[sum(ord(c) for c in lower) % len(palette)]


def _accent_for(color: str) -> str:
    return {
        "#7bc96f": "#c8f0a8",
        "#5ab0ff": "#d0ecff",
        "#ffe066": "#fff6c8",
        "#c49bff": "#eee0ff",
        "#d4b0ff": "#f6ecff",
        "#ff9a5a": "#ffe0c8",
        "#ff9ec5": "#ffe0f0",
        "#ff6b6b": "#ffd0d0",
        "#4aa8d8": "#c8ecff",
    }.get(color, "#fff6e8")


def _pick_shape(lower: str) -> tuple[str, str]:
    checks = (
        (("monster", "creature", "dragon", "dino"), "monster", "friendly monster"),
        (("heart", "love", "kiss"), "heart", "soft heart"),
        (("moon", "night"), "moon", "cozy moon"),
        (("star", "sparkle", "glitter", "magic"), "star", "sparkly star"),
        (("balloon", "party"), "balloon", "party balloon"),
        (("flower", "garden"), "flower", "happy flower"),
        (("cloud", "sky"), "cloud", "puffy cloud"),
        (("space", "galaxy", "planet", "rocket"), "planet", "little planet"),
        (("fish", "ocean", "sea"), "fish", "splashy fish"),
        (("butterfly", "bug"), "butterfly", "flutter bug"),
    )
    for words, shape, label in checks:
        if any(w in lower for w in words):
            return shape, label
    return "spark", "surprise spark"


def _charming_svg(shape: str, color: str, accent: str) -> str:
    """Hand-tuned cute SVGs — no text, no sad smiley blob."""
    eye = "#2a2a2a"
    if shape == "monster":
        return (
            f'<svg class="ent__svg" viewBox="0 0 72 72" aria-hidden="true">'
            f'<ellipse cx="36" cy="40" rx="24" ry="22" fill="{color}"/>'
            f'<ellipse cx="36" cy="46" rx="14" ry="10" fill="{accent}"/>'
            f'<circle cx="26" cy="34" r="5" fill="#fff"/><circle cx="46" cy="34" r="5" fill="#fff"/>'
            f'<circle cx="27" cy="35" r="2.4" fill="{eye}"/><circle cx="47" cy="35" r="2.4" fill="{eye}"/>'
            f'<path d="M28 50c3 5 13 5 16 0" fill="none" stroke="{eye}" stroke-width="2.5" stroke-linecap="round"/>'
            f'<circle cx="18" cy="22" r="4" fill="{color}"/><circle cx="54" cy="22" r="4" fill="{color}"/>'
            f"</svg>"
        )
    if shape == "heart":
        return (
            f'<svg class="ent__svg" viewBox="0 0 72 72" aria-hidden="true">'
            f'<path d="M36 58 C18 44 12 32 18 22 C22 16 30 16 36 24 C42 16 50 16 54 22 '
            f'C60 32 54 44 36 58Z" fill="{color}"/>'
            f'<ellipse cx="28" cy="28" rx="5" ry="3" fill="{accent}" opacity="0.7"/>'
            f"</svg>"
        )
    if shape == "moon":
        return (
            f'<svg class="ent__svg" viewBox="0 0 72 72" aria-hidden="true">'
            f'<circle cx="36" cy="36" r="24" fill="{color}"/>'
            f'<circle cx="46" cy="30" r="18" fill="{accent}"/>'
            f'<circle cx="30" cy="34" r="2.2" fill="{eye}"/><circle cx="40" cy="34" r="2.2" fill="{eye}"/>'
            f'<path d="M30 44c3 4 9 4 12 0" fill="none" stroke="{eye}" stroke-width="2" stroke-linecap="round"/>'
            f"</svg>"
        )
    if shape == "star":
        return (
            f'<svg class="ent__svg" viewBox="0 0 72 72" aria-hidden="true">'
            f'<polygon points="36,8 42,28 64,28 46,40 52,60 36,48 20,60 26,40 8,28 30,28" fill="{color}"/>'
            f'<circle cx="36" cy="34" r="6" fill="{accent}"/>'
            f"</svg>"
        )
    if shape == "balloon":
        return (
            f'<svg class="ent__svg" viewBox="0 0 72 72" aria-hidden="true">'
            f'<ellipse cx="36" cy="28" rx="18" ry="22" fill="{color}"/>'
            f'<ellipse cx="30" cy="20" rx="5" ry="7" fill="{accent}" opacity="0.75"/>'
            f'<path d="M36 50 L34 66 L38 66 Z" fill="{color}"/>'
            f'<path d="M36 66 Q30 70 36 74 Q42 70 36 66" fill="none" stroke="#c44a72" stroke-width="2"/>'
            f"</svg>"
        )
    if shape == "flower":
        return (
            f'<svg class="ent__svg" viewBox="0 0 72 72" aria-hidden="true">'
            f'<circle cx="36" cy="22" r="9" fill="{color}"/><circle cx="50" cy="30" r="9" fill="{color}"/>'
            f'<circle cx="50" cy="46" r="9" fill="{color}"/><circle cx="36" cy="54" r="9" fill="{color}"/>'
            f'<circle cx="22" cy="46" r="9" fill="{color}"/><circle cx="22" cy="30" r="9" fill="{color}"/>'
            f'<circle cx="36" cy="38" r="10" fill="{accent}"/>'
            f'<circle cx="33" cy="36" r="1.8" fill="{eye}"/><circle cx="39" cy="36" r="1.8" fill="{eye}"/>'
            f"</svg>"
        )
    if shape == "cloud":
        return (
            f'<svg class="ent__svg" viewBox="0 0 72 72" aria-hidden="true">'
            f'<ellipse cx="28" cy="40" rx="16" ry="12" fill="{color}"/>'
            f'<ellipse cx="46" cy="40" rx="14" ry="11" fill="{color}"/>'
            f'<ellipse cx="36" cy="30" rx="14" ry="12" fill="{color}"/>'
            f'<circle cx="30" cy="38" r="2" fill="{eye}"/><circle cx="42" cy="38" r="2" fill="{eye}"/>'
            f'<path d="M30 46c3 3 9 3 12 0" fill="none" stroke="{eye}" stroke-width="2" stroke-linecap="round"/>'
            f"</svg>"
        )
    if shape == "planet":
        return (
            f'<svg class="ent__svg" viewBox="0 0 72 72" aria-hidden="true">'
            f'<circle cx="36" cy="36" r="18" fill="{color}"/>'
            f'<ellipse cx="36" cy="36" rx="28" ry="7" fill="none" stroke="{accent}" stroke-width="3"/>'
            f'<circle cx="28" cy="30" r="4" fill="{accent}" opacity="0.8"/>'
            f'<circle cx="44" cy="40" r="3" fill="{accent}" opacity="0.7"/>'
            f"</svg>"
        )
    if shape == "fish":
        return (
            f'<svg class="ent__svg" viewBox="0 0 72 72" aria-hidden="true">'
            f'<ellipse cx="34" cy="36" rx="20" ry="12" fill="{color}"/>'
            f'<path d="M52 36 L66 24 L66 48 Z" fill="{accent}"/>'
            f'<circle cx="24" cy="34" r="2.4" fill="{eye}"/>'
            f'<path d="M14 36 Q20 28 26 36 Q20 44 14 36" fill="{accent}"/>'
            f"</svg>"
        )
    if shape == "butterfly":
        return (
            f'<svg class="ent__svg" viewBox="0 0 72 72" aria-hidden="true">'
            f'<ellipse cx="22" cy="28" rx="12" ry="16" fill="{color}"/>'
            f'<ellipse cx="50" cy="28" rx="12" ry="16" fill="{color}"/>'
            f'<ellipse cx="22" cy="48" rx="10" ry="12" fill="{accent}"/>'
            f'<ellipse cx="50" cy="48" rx="10" ry="12" fill="{accent}"/>'
            f'<rect x="34" y="20" width="4" height="36" rx="2" fill="{eye}"/>'
            f'<circle cx="36" cy="18" r="3" fill="{color}"/>'
            f"</svg>"
        )
    # spark (default)
    return (
        f'<svg class="ent__svg" viewBox="0 0 72 72" aria-hidden="true">'
        f'<circle cx="36" cy="36" r="14" fill="{color}"/>'
        f'<path d="M36 8 L38 28 L36 36 L34 28 Z" fill="{accent}"/>'
        f'<path d="M36 64 L38 44 L36 36 L34 44 Z" fill="{accent}"/>'
        f'<path d="M8 36 L28 38 L36 36 L28 34 Z" fill="{accent}"/>'
        f'<path d="M64 36 L44 38 L36 36 L44 34 Z" fill="{accent}"/>'
        f'<circle cx="36" cy="36" r="6" fill="#fff" opacity="0.85"/>'
        f"</svg>"
    )


def _parse_json(content: str) -> dict[str, Any]:
    content = content.strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", content)
        if m:
            return json.loads(m.group(0))
        raise

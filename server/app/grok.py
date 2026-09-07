"""xAI Grok adapter — returns JSON patches / customEntity parts. Charming fallback when no API key."""

from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx

from . import banks
from .catalog import glossary
from .patches import _ensure_ambient, apply_json_patch

XAI_URL = "https://api.x.ai/v1/chat/completions"
DEFAULT_MODEL = os.getenv("XAI_MODEL", "grok-3-mini")

SHAPE_PARTS: dict[str, dict[str, Any]] = {
    "monster": {"parts": {"body": "blob", "eyes": "googly", "mouth": "open-munch", "extras": ["horns"]}, "behavior": "drop_ready", "label": "friendly monster"},
    "unicorn": {"parts": {"body": "egg", "eyes": "sparkly", "mouth": "smile", "extras": ["horn", "tail"]}, "behavior": "float_pop", "label": "magical unicorn"},
    "dragon": {"parts": {"body": "long", "eyes": "happy", "mouth": "grin", "extras": ["wings", "tail", "horns"]}, "behavior": "float_pop", "label": "friendly dragon"},
    "kitty": {"parts": {"body": "round", "eyes": "happy", "mouth": "smile", "extras": ["ears", "tail"]}, "behavior": "scurry_nibble", "label": "cute kitty"},
    "puppy": {"parts": {"body": "blob", "eyes": "big", "mouth": "grin", "extras": ["ears", "tail"]}, "behavior": "scurry_nibble", "label": "playful puppy"},
    "truck": {"parts": {"body": "long", "eyes": "big", "mouth": "smile", "extras": ["stripes"]}, "behavior": "drop_ready", "label": "zoomy truck"},
    "digger": {"parts": {"body": "long", "eyes": "big", "mouth": "smile", "extras": ["stripes"]}, "behavior": "drop_ready", "label": "busy digger"},
    "train": {"parts": {"body": "long", "eyes": "happy", "mouth": "smile", "extras": ["stripes", "hat"]}, "behavior": "drop_ready", "label": "choo-choo train"},
    "rocket": {"parts": {"body": "tall", "eyes": "sparkly", "mouth": "tiny-o", "extras": ["wings"]}, "behavior": "float_pop", "label": "zoomy rocket"},
    "robot": {"parts": {"body": "round", "eyes": "big", "mouth": "grin", "extras": ["antennae"]}, "behavior": "drop_ready", "label": "beepy robot"},
    "bunny": {"parts": {"body": "egg", "eyes": "happy", "mouth": "smile", "extras": ["ears", "tail"]}, "behavior": "scurry_nibble", "label": "hoppy bunny"},
    "bear": {"parts": {"body": "round", "eyes": "sleepy", "mouth": "smile", "extras": ["ears"]}, "behavior": "drop_ready", "label": "cuddly bear"},
    "elephant": {"parts": {"body": "blob", "eyes": "big", "mouth": "smile", "extras": ["ears", "tail"]}, "behavior": "drop_ready", "label": "gentle elephant"},
    "monkey": {"parts": {"body": "round", "eyes": "googly", "mouth": "grin", "extras": ["ears", "tail"]}, "behavior": "scurry_nibble", "label": "silly monkey"},
    "penguin": {"parts": {"body": "egg", "eyes": "happy", "mouth": "smile", "extras": ["wings"]}, "behavior": "splash_swim", "label": "waddly penguin"},
    "snowman": {"parts": {"body": "round", "eyes": "happy", "mouth": "smile", "extras": ["hat"]}, "behavior": "drop_ready", "label": "frosty snowman"},
    "fish": {"parts": {"body": "long", "eyes": "big", "mouth": "tiny-o", "extras": ["tail", "stripes"]}, "behavior": "splash_swim", "label": "splashy fish"},
    "bee": {"parts": {"body": "egg", "eyes": "happy", "mouth": "smile", "extras": ["wings", "stripes"]}, "behavior": "float_pop", "label": "buzzy bee"},
    "ladybug": {"parts": {"body": "round", "eyes": "sparkly", "mouth": "smile", "extras": ["spots", "antennae"]}, "behavior": "float_pop", "label": "spotty ladybug"},
    "frog": {"parts": {"body": "blob", "eyes": "googly", "mouth": "grin", "extras": ["spots"]}, "behavior": "splash_swim", "label": "leapy frog"},
    "pig": {"parts": {"body": "round", "eyes": "happy", "mouth": "tiny-o", "extras": ["ears", "tail"]}, "behavior": "drop_ready", "label": "oinky pig"},
    "cow": {"parts": {"body": "blob", "eyes": "sleepy", "mouth": "smile", "extras": ["spots", "horns"]}, "behavior": "drop_ready", "label": "mooey cow"},
    "duck": {"parts": {"body": "egg", "eyes": "happy", "mouth": "smile", "extras": ["wings", "tail"]}, "behavior": "splash_swim", "label": "quacky duck"},
    "sheep": {"parts": {"body": "round", "eyes": "sleepy", "mouth": "smile", "extras": ["ears"]}, "behavior": "drop_ready", "label": "fluffy sheep"},
    "horse": {"parts": {"body": "tall", "eyes": "big", "mouth": "smile", "extras": ["ears", "tail"]}, "behavior": "drop_ready", "label": "gallopy horse"},
    "lion": {"parts": {"body": "round", "eyes": "happy", "mouth": "grin", "extras": ["ears", "tail"]}, "behavior": "drop_ready", "label": "roar-y lion"},
    "tiger": {"parts": {"body": "long", "eyes": "happy", "mouth": "grin", "extras": ["stripes", "ears"]}, "behavior": "scurry_nibble", "label": "stripey tiger"},
    "owl": {"parts": {"body": "round", "eyes": "big", "mouth": "tiny-o", "extras": ["ears", "wings"]}, "behavior": "float_pop", "label": "wise owl"},
    "crab": {"parts": {"body": "round", "eyes": "googly", "mouth": "grin", "extras": ["spots"]}, "behavior": "scurry_nibble", "label": "pinchy crab"},
    "heart": {"parts": {"body": "egg", "eyes": "happy", "mouth": "smile", "extras": ["spots"]}, "behavior": "float_pop", "label": "soft heart"},
    "moon": {"parts": {"body": "round", "eyes": "sleepy", "mouth": "smile", "extras": []}, "behavior": "float_pop", "label": "cozy moon"},
    "star": {"parts": {"body": "round", "eyes": "sparkly", "mouth": "smile", "extras": ["crown"]}, "behavior": "float_pop", "label": "sparkly star"},
    "balloon": {"parts": {"body": "round", "eyes": "happy", "mouth": "smile", "extras": ["tail"]}, "behavior": "float_pop", "label": "party balloon"},
    "flower": {"parts": {"body": "round", "eyes": "happy", "mouth": "smile", "extras": ["crown"]}, "behavior": "drop_ready", "label": "happy flower"},
    "cloud": {"parts": {"body": "blob", "eyes": "sleepy", "mouth": "smile", "extras": []}, "behavior": "float_pop", "label": "puffy cloud"},
    "planet": {"parts": {"body": "round", "eyes": "big", "mouth": "smile", "extras": ["spots"]}, "behavior": "float_pop", "label": "little planet"},
    "butterfly": {"parts": {"body": "egg", "eyes": "happy", "mouth": "smile", "extras": ["wings", "antennae"]}, "behavior": "float_pop", "label": "flutter bug"},
    "spark": {"parts": {"body": "round", "eyes": "sparkly", "mouth": "smile", "extras": ["crown"]}, "behavior": "float_pop", "label": "surprise spark"},
}


def _api_key() -> str | None:
    return os.getenv("XAI_API_KEY") or os.getenv("GROK_API_KEY")


def _expand_palette(patch: dict[str, Any]) -> dict[str, Any]:
    palette_name = patch.pop("palette", None)
    if not palette_name:
        return patch
    try:
        resolved = banks.palette_patch(palette_name)
    except KeyError:
        return patch
    merged_theme = dict(resolved.get("theme") or {})
    merged_theme.update(patch.get("theme") or {})
    patch["theme"] = merged_theme
    patch["_palette_ambient"] = resolved.get("ambient") or []
    return patch


def _apply_patch_with_palette(spec: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    palette_ambient = patch.pop("_palette_ambient", None)
    new_spec = apply_json_patch(spec, patch)
    if palette_ambient:
        for amb in palette_ambient:
            _ensure_ambient(new_spec, amb["kind"])
    return new_spec


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

    vocab = banks.compact_vocab()
    cat = glossary()

    system = (
        "You edit toddler keyboard-mash games (ages 1–3) described by a GameSpec JSON.\n"
        "The parent just made a WISH with their kid — grant it with delight.\n"
        "Return ONLY valid JSON with this shape:\n"
        '{"patch": {"palette": "space-night", "customEntities": {"wish_x": {"role":"spawn",'
        '"parts":{"body":"blob","color":"#ff9ec5","eyes":"googly","mouth":"smile","extras":["horns"]},'
        '"behavior":"float_pop"}}, "title": "optional", "theme": {"wallColor": "#..."}}, '
        '"note": "warm short parent-facing note"}\n'
        "Rules:\n"
        "- Prefer a named palette over hand-picked theme colors.\n"
        "- Choose behavior from spawn behaviors: bake_ready, drop_ready, float_pop, splash_swim, scurry_nibble.\n"
        "  Motion makes creatures feel alive — never leave default drop_ready without reason.\n"
        "- Use parts only — NEVER return raw SVG. Never return raw SVG.\n"
        "- parts fields: body, color (#hex), accent (#hex optional), eyes, mouth, extras (max 3).\n"
        f"- Parts vocabulary: {json.dumps(vocab)}\n"
        f"- Catalog: {json.dumps(cat)}\n"
        "- Never rewrite the whole game unless asked. Never empty onMash.\n"
        '- note should sound like a spell landing, e.g. "A giggly monster joined the mash!"'
    )

    recent = history[-3:] if history else []
    on_mash_kinds = [item.get("kind") for item in (spec.get("onMash") or []) if item.get("kind")]
    actor_kinds = [a.get("kind") for a in (spec.get("actors") or []) if a.get("kind")]
    user_payload = {
        "current_spec": {
            "id": spec.get("id"),
            "title": spec.get("title"),
            "scene": {"template": (spec.get("scene") or {}).get("template")},
            "onMash": on_mash_kinds,
            "actors": actor_kinds,
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
    patch = _expand_palette(dict(patch))
    new_spec = _apply_patch_with_palette(spec, patch)
    return new_spec, usage, note


def _offline_freewheel(spec: dict[str, Any], text: str) -> tuple[dict[str, Any], dict[str, Any], str]:
    """Parts-based invent stub when no API key."""
    lower = text.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", lower).strip("-")[:24] or "surprise"
    eid = f"wish_{slug.replace('-', '_')}"[:40]
    color = _pick_color(lower)
    shape_key, label = _pick_shape(lower)
    entry = SHAPE_PARTS.get(shape_key, SHAPE_PARTS["spark"])
    parts = dict(entry["parts"])
    parts["color"] = color
    behavior = entry["behavior"]
    sound_spawn = "inflate" if behavior == "float_pop" else "cookieDrop"
    sound_hit = "pop" if behavior == "float_pop" else "munch"

    patch: dict[str, Any] = {
        "customEntities": {
            eid: {
                "role": "spawn",
                "width": 72,
                "height": 72,
                "behavior": behavior,
                "parts": parts,
                "soundSpawn": sound_spawn,
                "soundInteract": sound_hit,
            }
        }
    }

    palette_name = banks.match_palette(text)
    if palette_name:
        patch["palette"] = palette_name

    patch = _expand_palette(patch)
    new_spec = _apply_patch_with_palette(spec, patch)

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
    palette = ["#ff9ec5", "#c49bff", "#5ab0ff", "#ffe066", "#7bc96f", "#ff9a5a"]
    return palette[sum(ord(c) for c in lower) % len(palette)]


def _pick_shape(lower: str) -> tuple[str, str]:
    checks = (
        (("unicorn",), "unicorn"),
        (("dragon",), "dragon"),
        (("kitty", "kitten", "cat"), "kitty"),
        (("puppy", "dog"), "puppy"),
        (("truck", "lorry"), "truck"),
        (("digger", "excavator"), "digger"),
        (("train", "choo"), "train"),
        (("rocket", "spaceship"), "rocket"),
        (("robot",), "robot"),
        (("bunny", "rabbit"), "bunny"),
        (("bear",), "bear"),
        (("elephant",), "elephant"),
        (("monkey",), "monkey"),
        (("penguin",), "penguin"),
        (("snowman",), "snowman"),
        (("fish",), "fish"),
        (("bee",), "bee"),
        (("ladybug", "ladybird"), "ladybug"),
        (("frog",), "frog"),
        (("pig",), "pig"),
        (("cow",), "cow"),
        (("duck",), "duck"),
        (("sheep", "lamb"), "sheep"),
        (("horse",), "horse"),
        (("lion",), "lion"),
        (("tiger",), "tiger"),
        (("owl",), "owl"),
        (("crab",), "crab"),
        (("monster", "creature", "dino"), "monster"),
        (("heart", "love", "kiss"), "heart"),
        (("moon", "night"), "moon"),
        (("star", "sparkle", "glitter", "magic"), "star"),
        (("balloon", "party"), "balloon"),
        (("flower", "garden"), "flower"),
        (("cloud", "sky"), "cloud"),
        (("space", "galaxy", "planet"), "planet"),
        (("butterfly", "bug"), "butterfly"),
    )
    for words, shape in checks:
        if any(w in lower for w in words):
            entry = SHAPE_PARTS[shape]
            return shape, entry["label"]
    return "spark", SHAPE_PARTS["spark"]["label"]


def _parse_json(content: str) -> dict[str, Any]:
    content = content.strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", content)
        if m:
            return json.loads(m.group(0))
        raise

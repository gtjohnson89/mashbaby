"""Deterministic GameSpec patches for common kid tweaks (no LLM)."""

from __future__ import annotations

import copy
import re
from typing import Any

from .catalog import ACTORS, AMBIENT, COLORS, SPAWNS, TEMPLATES


def deep_copy(spec: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(spec)


def pick_template(text: str) -> str:
    lower = text.lower()
    best = "blank-room"
    best_score = 0
    for tid, meta in TEMPLATES.items():
        score = sum(1 for kw in meta["keywords"] if kw in lower)
        if score > best_score:
            best_score = score
            best = tid
    return best


def build_from_prompt(text: str) -> dict[str, Any]:
    """Create an initial GameSpec from a free-text description using catalog only."""
    template_id = pick_template(text)
    base = deep_copy(TEMPLATES[template_id]["default_spec"])
    title = _title_from_prompt(text)
    spec: dict[str, Any] = {
        "id": re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "mash-game",
        "title": title,
        "brand": "mashbaby",
        "copy": f"Mash any key! ({text.strip()[:120]})",
        **base,
    }

    # Pull catalog entities mentioned in the prompt into the spec
    for kind, meta in SPAWNS.items():
        if _mentions(text, meta["labels"]):
            _ensure_spawn(spec, kind)

    for kind, meta in ACTORS.items():
        if _mentions(text, meta["labels"]):
            _ensure_actor(spec, kind)

    for kind, meta in AMBIENT.items():
        if _mentions(text, meta["labels"]):
            _ensure_ambient(spec, kind)

    # Theme color hints in the initial prompt
    color = _find_color(text)
    if color and any(w in text.lower() for w in ("wall", "walls", "pink", "purple", "blue")):
        if "wall" in text.lower() or color:
            _set_wall_color(spec, color)

    return spec


def classify_tweak(text: str) -> str:
    lower = text.lower().strip()
    if any(w in lower for w in ("start over", "new game", "from scratch", "rethink")):
        return "full_rethink"
    if _find_color(lower) and any(
        w in lower for w in ("wall", "walls", "floor", "sky", "grass", "water", "make", "paint", "color", "colour")
    ):
        return "theme"
    if _find_color(lower) and len(lower.split()) <= 3:
        # bare "purple" after walls were discussed → theme
        return "theme"

    spawn_or_actor = any(_mentions(lower, meta["labels"]) for meta in list(SPAWNS.values()) + list(ACTORS.values()))
    ambient_hit = _ambient_hit(lower)
    wants_more = bool(re.search(r"\b(more|another|extra)\b", lower))

    # "more ducks" when ducks already exist → bump limits / ambient counts
    if wants_more and (spawn_or_actor or ambient_hit):
        return "more"

    if spawn_or_actor:
        return "catalog_add"

    # Ambient only when the ask is basically just ambient (not "unicorn that sparkles")
    if ambient_hit and _is_mostly_ambient(lower):
        return "ambient"

    if _catalog_hit(lower):
        return "catalog_add"
    return "freewheel"


def _is_mostly_ambient(text: str) -> bool:
    cleaned = re.sub(
        r"\b(add|more|some|the|a|an|in|to|please|also|want|with|and|flying|sky|background|there|be|are|is)\b",
        " ",
        text.lower(),
    )
    cleaned = re.sub(r"[^a-z0-9#\s]", " ", cleaned)
    words = [w for w in cleaned.split() if w]
    ambient_words = {
        "bird",
        "birds",
        "cloud",
        "clouds",
        "bubble",
        "bubbles",
        "sparkle",
        "sparkles",
        "glitter",
    }
    if not words:
        return False
    return all(w in ambient_words or w in COLORS or w.startswith("#") for w in words)


def apply_tweak(spec: dict[str, Any], text: str) -> tuple[dict[str, Any], str, dict[str, Any]]:
    """
    Apply a natural-language tweak.
    Returns (new_spec, intent, usage_stub).
    """
    intent = classify_tweak(text)
    usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "path": "deterministic"}
    new_spec = deep_copy(spec)

    if intent == "full_rethink":
        new_spec = build_from_prompt(text)
        return new_spec, intent, usage

    if intent == "theme":
        color = _find_color(text)
        if color:
            lower = text.lower()
            if "floor" in lower:
                new_spec.setdefault("theme", {})["floorColor"] = color
            elif "sky" in lower:
                new_spec.setdefault("theme", {})["skyTop"] = color
                new_spec.setdefault("theme", {})["skyBot"] = color
            elif "grass" in lower:
                new_spec.setdefault("theme", {})["grassColor"] = color
            elif "water" in lower:
                new_spec.setdefault("theme", {})["waterColor"] = color
            else:
                # default: walls (the common kid request)
                _set_wall_color(new_spec, color)
        return new_spec, intent, usage

    if intent == "more":
        _apply_more(new_spec, text)
        return new_spec, intent, usage

    if intent == "ambient":
        for kind, meta in AMBIENT.items():
            if _mentions(text, meta["labels"]) or (kind == "birds" and ("bird" in text.lower() or "flying" in text.lower())):
                _ensure_ambient(new_spec, kind)
        return new_spec, intent, usage

    if intent == "catalog_add":
        for kind, meta in SPAWNS.items():
            if _mentions(text, meta["labels"]):
                _ensure_spawn(new_spec, kind)
        for kind, meta in ACTORS.items():
            if _mentions(text, meta["labels"]):
                _ensure_actor(new_spec, kind)
        for kind, meta in AMBIENT.items():
            if _mentions(text, meta["labels"]):
                _ensure_ambient(new_spec, kind)
        return new_spec, intent, usage

    # freewheel — caller may escalate to Grok; leave spec unchanged here
    return new_spec, intent, usage


def _apply_more(spec: dict[str, Any], text: str) -> None:
    """Bump existing catalog things, or add them if missing."""
    hit = False
    for kind, meta in SPAWNS.items():
        if _mentions(text, meta["labels"]):
            hit = True
            before = len(spec.get("onMash") or [])
            _ensure_spawn(spec, kind)
            after = len(spec.get("onMash") or [])
            if before == after:
                limits = spec.setdefault("limits", {})
                cur = int(limits.get("maxSpawns") or 12)
                limits["maxSpawns"] = min(28, cur + 4)
    for kind, meta in ACTORS.items():
        if _mentions(text, meta["labels"]):
            hit = True
            actors = spec.setdefault("actors", [])
            existing = next((a for a in actors if a.get("kind") == kind), None)
            if existing:
                existing["max"] = min(16, int(existing.get("max") or 8) + 2)
            else:
                _ensure_actor(spec, kind)
    for kind, meta in AMBIENT.items():
        if _mentions(text, meta["labels"]) or (kind == "birds" and "bird" in text.lower()):
            hit = True
            ambient = spec.setdefault("ambient", [])
            existing = next((a for a in ambient if a.get("kind") == kind), None)
            if existing:
                existing["count"] = min(12, int(existing.get("count") or 3) + 2)
            else:
                _ensure_ambient(spec, kind)
    if not hit:
        # bare "more" — gently raise spawn cap
        limits = spec.setdefault("limits", {})
        cur = int(limits.get("maxSpawns") or 12)
        limits["maxSpawns"] = min(28, cur + 4)


def apply_json_patch(spec: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """Shallow-merge structured patch from Grok (theme/onMash/actors/ambient/customEntities/title/copy)."""
    new_spec = deep_copy(spec)
    for key in ("title", "copy", "brand", "id"):
        if key in patch and patch[key] is not None:
            new_spec[key] = patch[key]
    if "theme" in patch and isinstance(patch["theme"], dict):
        new_spec.setdefault("theme", {}).update(patch["theme"])
    if "scene" in patch and isinstance(patch["scene"], dict):
        new_spec["scene"] = patch["scene"]
    if "onMash" in patch and isinstance(patch["onMash"], list):
        new_spec["onMash"] = patch["onMash"]
    if "actors" in patch and isinstance(patch["actors"], list):
        new_spec["actors"] = patch["actors"]
    if "ambient" in patch and isinstance(patch["ambient"], list):
        new_spec["ambient"] = patch["ambient"]
    if "limits" in patch and isinstance(patch["limits"], dict):
        new_spec.setdefault("limits", {}).update(patch["limits"])
    if "customEntities" in patch and isinstance(patch["customEntities"], dict):
        new_spec.setdefault("customEntities", {}).update(patch["customEntities"])
        # Auto-wire custom entities into onMash/actors if role set
        for cid, cent in patch["customEntities"].items():
            role = (cent or {}).get("role")
            if role == "spawn":
                _ensure_spawn(new_spec, cid)
            elif role == "actor":
                _ensure_actor(new_spec, cid)
            elif role == "ambient":
                _ensure_ambient(new_spec, cid)
    return new_spec


def _title_from_prompt(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text.strip())
    if len(cleaned) <= 40:
        return cleaned.title() if cleaned.islower() else cleaned
    return cleaned[:37].rstrip() + "…"


def _mentions(text: str, labels: list[str]) -> bool:
    lower = text.lower()
    return any(re.search(rf"\b{re.escape(label)}\b", lower) for label in labels)


def _find_color(text: str) -> str | None:
    # Avoid "ice cream" matching color "cream"
    lower = re.sub(r"\bice[\s-]?cream\b", " ", text.lower())
    # longer names first
    for name in sorted(COLORS.keys(), key=len, reverse=True):
        if re.search(rf"\b{re.escape(name)}\b", lower):
            return COLORS[name]
    # hex
    m = re.search(r"#(?:[0-9a-fA-F]{3,8})\b", text)
    if m:
        return m.group(0)
    return None


def _catalog_hit(text: str) -> bool:
    for meta in list(SPAWNS.values()) + list(ACTORS.values()):
        if _mentions(text, meta["labels"]):
            return True
    return False


def _ambient_hit(text: str) -> bool:
    if re.search(r"\bbirds?\b", text.lower()):
        return True
    return any(_mentions(text, meta["labels"]) for meta in AMBIENT.values())


def _set_wall_color(spec: dict[str, Any], color: str) -> None:
    theme = spec.setdefault("theme", {})
    theme["wallColor"] = color
    # Derive a second dot color that's a lighter mix feel
    dots = theme.get("wallDotColors") or ["#ff9ec5", "#c49bff"]
    theme["wallDotColors"] = [color, dots[1] if len(dots) > 1 else "#ffffff"]


def _ensure_spawn(spec: dict[str, Any], kind: str) -> None:
    mash = spec.setdefault("onMash", [])
    if any(item.get("kind") == kind for item in mash):
        return
    # Split weight with existing
    mash.append({"kind": kind, "weight": 40 if mash else 100})
    if len(mash) > 1:
        each = max(1, 100 // len(mash))
        for item in mash:
            item["weight"] = each


def _ensure_actor(spec: dict[str, Any], kind: str) -> None:
    actors = spec.setdefault("actors", [])
    if any(a.get("kind") == kind for a in actors):
        return
    actors.append({"kind": kind, "behavior": "seek_and_munch", "max": 8})


def _ensure_ambient(spec: dict[str, Any], kind: str) -> None:
    ambient = spec.setdefault("ambient", [])
    if any(a.get("kind") == kind for a in ambient):
        return
    count = 4 if kind == "birds" else 3
    ambient.append({"kind": kind, "count": count})

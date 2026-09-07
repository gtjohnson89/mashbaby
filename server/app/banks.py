"""Loads engine/banks/*.json — one source of truth shared with the browser."""

from __future__ import annotations

import copy
import json
import re
from pathlib import Path
from typing import Any

BANKS_DIR = Path(__file__).resolve().parents[2] / "engine" / "banks"

_cache: dict[str, Any] = {}


def _load(name: str) -> dict[str, Any]:
    if name not in _cache:
        path = BANKS_DIR / f"{name}.json"
        with open(path, encoding="utf-8") as f:
            _cache[name] = json.load(f)
    return _cache[name]


def parts_vocab() -> dict[str, Any]:
    return copy.deepcopy(_load("parts"))


def palettes() -> dict[str, Any]:
    return copy.deepcopy(_load("palettes"))


def match_palette(text: str) -> str | None:
    """Whole-word, case-insensitive keyword match. Longest keyword wins."""
    lower = text.lower()
    best_name: str | None = None
    best_len = 0
    for name, meta in _load("palettes")["palettes"].items():
        for kw in meta.get("keywords") or []:
            if re.search(rf"\b{re.escape(kw.lower())}\b", lower):
                if len(kw) > best_len:
                    best_len = len(kw)
                    best_name = name
    return best_name


def palette_patch(name: str) -> dict[str, Any]:
    """{"theme": {...}} plus {"ambient": [...]} when the palette defines it."""
    meta = _load("palettes")["palettes"][name]
    out: dict[str, Any] = {"theme": copy.deepcopy(meta.get("theme") or {})}
    if meta.get("ambient"):
        out["ambient"] = copy.deepcopy(meta["ambient"])
    return out


def compact_vocab() -> dict[str, Any]:
    """Token-cheap vocab for prompts: bare enum lists + palette names only."""
    parts = _load("parts")
    return {
        "bodies": list(parts["bodies"]),
        "eyes": list(parts["eyes"]),
        "mouths": list(parts["mouths"]),
        "extras": list(parts["extras"]),
        "colors": list(parts["palette"]),
        "palettes": list(_load("palettes")["palettes"].keys()),
    }

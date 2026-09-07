"""Spellbook — normalize wishes, cache patches, serve instant hits."""

from __future__ import annotations

import json
import re
from typing import Any

from . import db

FILLER = {
    "a",
    "an",
    "the",
    "some",
    "add",
    "make",
    "put",
    "can",
    "we",
    "have",
    "i",
    "want",
    "please",
    "get",
    "give",
    "us",
    "me",
    "my",
    "with",
    "to",
    "in",
    "into",
    "turn",
    "it",
    "there",
    "be",
    "of",
    "and",
    "for",
    "lets",
    "let's",
    "how",
    "about",
    "would",
    "like",
}

PLURAL_MAP = {
    "ducks": "duck",
    "mice": "mouse",
    "babies": "baby",
}

_MAX_PATCH_BYTES = 8192


def normalize(text: str) -> str:
    """Lowercase, strip punctuation, drop filler, collapse whitespace."""
    cleaned = re.sub(r"[^a-z0-9]+", " ", text.lower())
    tokens = []
    for token in cleaned.split():
        if token in FILLER:
            continue
        tokens.append(PLURAL_MAP.get(token, token))
    result = " ".join(tokens)[:120]
    return result


def lookup(text: str) -> dict[str, Any] | None:
    key = normalize(text)
    if not key:
        return None
    return db.spell_get(key)


def remember(text: str, patch: dict[str, Any], note: str, source: str) -> None:
    key = normalize(text)
    if not key or not patch:
        return
    if _patch_has_raw_svg(patch):
        return
    if len(json.dumps(patch)) > _MAX_PATCH_BYTES:
        return
    db.spell_put(key, text, patch, note, source)


def _patch_has_raw_svg(patch: dict[str, Any]) -> bool:
    entities = patch.get("customEntities") or {}
    for entry in entities.values():
        if isinstance(entry, dict) and entry.get("svg"):
            return True
    return False

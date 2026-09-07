"""Private-link game saves — unlisted slugs, no enumeration."""

from __future__ import annotations

import re
import secrets
from typing import Any

from . import db
from .limits import spec_too_big

SLUG_RE = re.compile(r"^[a-z]+-[a-z]+-[0-9a-f]{4}$")
SVG_XSS_RE = re.compile(r"<script|<foreignObject|<image|on\w+\s*=|javascript:", re.IGNORECASE)

ADJECTIVES = [
    "purple",
    "giggly",
    "sleepy",
    "bouncy",
    "sunny",
    "sparkly",
    "cozy",
    "silly",
    "happy",
    "snuggly",
    "wiggly",
    "fluffy",
    "bubbly",
    "zippy",
    "peachy",
    "minty",
    "rosy",
    "golden",
    "frosty",
    "velvet",
    "jolly",
    "twinkly",
    "chirpy",
    "dreamy",
    "playful",
    "cheery",
    "breezy",
    "snappy",
    "dizzy",
    "mellow",
    "zesty",
    "plucky",
    "dandy",
    "perky",
    "jazzy",
    "lovely",
    "snazzy",
    "glowy",
    "peppy",
    "zany",
]

NOUNS = [
    "dino",
    "duck",
    "cookie",
    "rocket",
    "kitty",
    "puppy",
    "star",
    "balloon",
    "monster",
    "bunny",
    "bear",
    "frog",
    "turtle",
    "panda",
    "owl",
    "fish",
    "cloud",
    "rainbow",
    "cupcake",
    "pizza",
    "train",
    "boat",
    "castle",
    "dragon",
    "unicorn",
    "robot",
    "penguin",
    "ladybug",
    "butterfly",
    "dolphin",
    "elephant",
    "giraffe",
    "lion",
    "mouse",
    "snail",
    "bee",
    "flower",
    "tree",
    "moon",
    "comet",
]


def make_slug() -> str:
    for _ in range(5):
        slug = f"{secrets.choice(ADJECTIVES)}-{secrets.choice(NOUNS)}-{secrets.token_hex(2)}"
        if not db.saved_game_exists(slug):
            return slug
    raise RuntimeError("Could not allocate a unique save slug")


def _title_from_spec(spec: dict[str, Any]) -> str:
    raw = str(spec.get("title") or "Our game")
    cleaned = "".join(ch for ch in raw if ch >= " " or ch == "\t")
    return cleaned.strip()[:120] or "Our game"


def _spec_has_bad_svg(spec: dict[str, Any]) -> bool:
    entities = spec.get("customEntities") or {}
    if not isinstance(entities, dict):
        return False
    for entry in entities.values():
        if not isinstance(entry, dict):
            continue
        svg = entry.get("svg")
        if isinstance(svg, str) and SVG_XSS_RE.search(svg):
            return True
    return False


def save(spec: dict[str, Any], license_ok: bool = True) -> dict[str, str]:
    if spec_too_big(spec):
        raise ValueError("spec_too_big")
    if _spec_has_bad_svg(spec):
        raise ValueError("unsafe_svg")
    title = _title_from_spec(spec)
    slug = make_slug()
    db.save_game(slug, spec, title)
    return {"slug": slug, "url": f"/g/{slug}"}


def load(slug: str) -> dict[str, Any] | None:
    if not SLUG_RE.match(slug):
        return None
    row = db.load_game(slug)
    if not row:
        return None
    return {"spec": row["spec"], "title": row["title"]}

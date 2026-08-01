"""Catalog of known spawns, actors, ambient, themes, and scene templates."""

from __future__ import annotations

SPAWNS = {
    "cookie": {"role": "spawn", "behavior": "bake_ready", "labels": ["cookie", "cookies", "biscuit"]},
    "icecream": {
        "role": "spawn",
        "behavior": "drop_ready",
        "labels": ["ice cream", "icecream", "ice-cream", "cone"],
    },
    "balloon": {"role": "spawn", "behavior": "float_pop", "labels": ["balloon", "balloons"]},
    "duck": {"role": "spawn", "behavior": "splash_swim", "labels": ["duck", "ducks", "duckling"]},
    "mouse": {"role": "spawn", "behavior": "scurry_nibble", "labels": ["mouse", "mice", "squeak", "cheese"]},
    "ball": {"role": "spawn", "behavior": "drop_ready", "labels": ["ball", "balls"]},
    "star": {"role": "spawn", "behavior": "drop_ready", "labels": ["star", "stars"]},
}

ACTORS = {
    "baby": {
        "role": "actor",
        "behavior": "seek_and_munch",
        "labels": ["baby", "babies", "toddler", "kid"],
    },
    "dino": {
        "role": "actor",
        "behavior": "seek_and_munch",
        "labels": ["dino", "dinosaur", "dinosaurs", "t-rex", "trex"],
    },
    "puppy": {
        "role": "actor",
        "behavior": "seek_and_munch",
        "labels": ["puppy", "puppies", "dog", "dogs"],
    },
}

AMBIENT = {
    "birds": {"labels": ["bird", "birds", "flying birds"]},
    "clouds": {"labels": ["cloud", "clouds"]},
    "bubbles": {"labels": ["bubble", "bubbles"]},
    "sparkles": {"labels": ["sparkle", "sparkles", "glitter"]},
}

COLORS = {
    "pink": "#ff9ec5",
    "hot pink": "#ff6b9d",
    "purple": "#c49bff",
    "lavender": "#d4b0ff",
    "blue": "#5ab0ff",
    "sky blue": "#7ec8ff",
    "green": "#7bc96f",
    "yellow": "#ffe066",
    "orange": "#ff9a5a",
    "red": "#ff6b6b",
    "white": "#fff6e8",
    "black": "#1a1218",
    "brown": "#8b4a1f",
    "cream": "#fff6e8",
    "teal": "#4aa8d8",
}

TEMPLATES = {
    "kitchen-mash": {
        "keywords": ["cookie", "kitchen", "oven", "baby", "babies", "bake", "treat", "ice cream"],
        "default_spec": {
            "scene": {"template": "kitchen-mash", "props": {}},
            "theme": {
                "wallColor": "#1a1218",
                "wallDotColors": ["#ff9ec5", "#c49bff"],
                "floorColor": "#f0c98a",
                "floorLine": "#e0b56e",
                "accent": "#d45a7a",
                "gateBtnFrom": "#e08940",
                "gateBtnTo": "#d45a7a",
            },
            "onMash": [{"kind": "cookie", "weight": 100}],
            "actors": [{"kind": "baby", "behavior": "seek_and_munch", "max": 8}],
            "ambient": [],
            "limits": {"maxSpawns": 18, "spawnCooldownMs": 90},
            "customEntities": {},
            "customize": {"persist": True, "wallPalette": True},
        },
    },
    "sky-pop": {
        "keywords": ["balloon", "sky", "pop", "float", "party"],
        "default_spec": {
            "scene": {"template": "sky-pop", "props": {}},
            "theme": {
                "skyTop": "#7ec8ff",
                "skyBot": "#c9e9ff",
                "grassColor": "#6fbf5a",
                "accent": "#e85a8a",
                "gateBtnFrom": "#ff6b9d",
                "gateBtnTo": "#5ab0ff",
            },
            "onMash": [{"kind": "balloon", "weight": 100}],
            "actors": [],
            "ambient": [{"kind": "clouds", "count": 3}],
            "limits": {"maxSpawns": 14, "spawnCooldownMs": 90},
            "customEntities": {},
            "customize": {"persist": True, "skyPalette": True, "grassPalette": True},
        },
    },
    "pond-splash": {
        "keywords": ["duck", "pond", "splash", "water", "quack", "swim"],
        "default_spec": {
            "scene": {"template": "pond-splash", "props": {}},
            "theme": {
                "skyTop": "#9ad4ff",
                "skyBot": "#e8f6ff",
                "grassColor": "#7bc96f",
                "waterColor": "#4aa8d8",
                "waterDeep": "#2f7fad",
                "accent": "#2f7fad",
                "gateBtnFrom": "#4aa8d8",
                "gateBtnTo": "#6fbf5a",
            },
            "onMash": [{"kind": "duck", "weight": 100}],
            "actors": [],
            "ambient": [],
            "limits": {"maxSpawns": 10, "spawnCooldownMs": 100},
            "customEntities": {},
            "customize": {"persist": True, "skyPalette": True, "waterPalette": True},
        },
    },
    "pantry-nibble": {
        "keywords": ["mouse", "mice", "cheese", "squeak", "nibble", "pantry"],
        "default_spec": {
            "scene": {"template": "pantry-nibble", "props": {}},
            "theme": {
                "wallColor": "#fff3e6",
                "wallDotColors": ["#ffe066", "#ff9ec5"],
                "floorColor": "#c89868",
                "floorLine": "#a87848",
                "accent": "#ffe066",
                "gateBtnFrom": "#ffe066",
                "gateBtnTo": "#ff9ec5",
            },
            "onMash": [{"kind": "mouse", "weight": 100}],
            "actors": [],
            "ambient": [{"kind": "sparkles", "count": 2}],
            "limits": {"maxSpawns": 12, "spawnCooldownMs": 100},
            "customEntities": {},
            "customize": {"persist": True, "wallPalette": True},
        },
    },
    "blank-room": {
        "keywords": [],
        "default_spec": {
            "scene": {"template": "blank-room", "props": {}},
            "theme": {
                "wallColor": "#2a3040",
                "wallDotColors": ["#7ec8ff", "#ff9ec5"],
                "floorColor": "#e8d5b5",
                "floorLine": "#d4c09a",
                "accent": "#5ab0ff",
                "gateBtnFrom": "#5ab0ff",
                "gateBtnTo": "#ff6b9d",
            },
            "onMash": [{"kind": "star", "weight": 100}],
            "actors": [],
            "ambient": [],
            "limits": {"maxSpawns": 16, "spawnCooldownMs": 90},
            "customEntities": {},
            "customize": {"persist": True, "wallPalette": True},
        },
    },
}


def glossary() -> dict:
    """Short catalog glossary for LLM prompts (token-cheap)."""
    return {
        "spawns": list(SPAWNS.keys()),
        "actors": list(ACTORS.keys()),
        "ambient": list(AMBIENT.keys()),
        "templates": list(TEMPLATES.keys()),
        "colors": list(COLORS.keys()),
        "theme_keys": [
            "wallColor",
            "wallDotColors",
            "floorColor",
            "skyTop",
            "skyBot",
            "grassColor",
            "waterColor",
            "accent",
        ],
    }

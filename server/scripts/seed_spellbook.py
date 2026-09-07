"""Batch seeder for the spellbook cache."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.app import db, spellbook
from server.app.catalog import TEMPLATES
from server.app.grok import _offline_freewheel_patch, generate_patch
from server.app.patches import classify_tweak

WISHES_FILE = ROOT / "server" / "data" / "top_wishes.txt"
BASE_SPEC = {
    "id": "blank-room",
    "title": "Blank Room",
    "brand": "mashbaby",
    "copy": "Mash any key!",
    **TEMPLATES["blank-room"]["default_spec"],
}


def _load_wishes(path: Path) -> list[str]:
    lines: list[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        lines.append(line)
    return lines


def _already_seeded(key: str) -> bool:
    return db.spell_exists(key)


async def _generate_for_wish(text: str, offline: bool) -> tuple[dict, str, dict]:
    if offline:
        patch, note = _offline_freewheel_patch(text)
        usage = {"total_tokens": 0, "path": "offline_freewheel"}
        return patch, note, usage
    patch, usage, note = await generate_patch(spec=BASE_SPEC, text=text, history=[])
    return patch, note, usage


async def _seed_wishes(
    wishes: list[str],
    *,
    offline: bool,
    force: bool,
    dry_run: bool,
    limit: int | None,
) -> dict[str, int]:
    totals = {"seeded": 0, "skipped": 0, "failed": 0, "tokens": 0}
    if limit is not None:
        wishes = wishes[:limit]

    for text in wishes:
        key = spellbook.normalize(text)
        if not key:
            print(f"  skip (empty key): {text!r}")
            totals["skipped"] += 1
            continue

        intent = classify_tweak(text)
        if intent != "freewheel":
            print(f"  skip (deterministic {intent}): {text!r}")
            totals["skipped"] += 1
            continue

        if not force and _already_seeded(key):
            print(f"  skip (exists): {text!r} -> {key!r}")
            totals["skipped"] += 1
            continue

        if dry_run:
            print(f"  dry-run would seed: {text!r} -> {key!r}")
            totals["seeded"] += 1
            continue

        for attempt in range(3):
            try:
                patch, note, usage = await _generate_for_wish(text, offline)
                spellbook.remember(text, patch, note, source="seed")
                tokens = int(usage.get("total_tokens") or 0)
                totals["tokens"] += tokens
                totals["seeded"] += 1
                print(f"  seeded: {text!r} -> {key!r} ({tokens} tokens)")
                break
            except Exception as exc:
                if attempt < 2:
                    print(f"  retry {attempt + 1}/2 for {text!r}: {exc}")
                    await asyncio.sleep(1.0)
                else:
                    print(f"  FAILED: {text!r}: {exc}")
                    totals["failed"] += 1
        await asyncio.sleep(0.5)

    return totals


def _import_hand_spells(path: Path, dry_run: bool) -> dict[str, int]:
    data = json.loads(path.read_text(encoding="utf-8"))
    totals = {"seeded": 0, "skipped": 0, "failed": 0}
    for text, entry in data.items():
        patch = entry.get("patch") or {}
        note = entry.get("note") or "Your wish came true!"
        key = spellbook.normalize(text)
        if not key:
            totals["skipped"] += 1
            continue
        if dry_run:
            print(f"  dry-run would import: {text!r} -> {key!r}")
            totals["seeded"] += 1
            continue
        try:
            spellbook.remember(text, patch, note, source="hand")
            totals["seeded"] += 1
            print(f"  imported: {text!r} -> {key!r}")
        except Exception as exc:
            print(f"  FAILED import {text!r}: {exc}")
            totals["failed"] += 1
    return totals


async def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the mashbaby spellbook")
    parser.add_argument("--offline", action="store_true", help="Use offline patch generator")
    parser.add_argument("--limit", type=int, default=None, help="Max wishes to process")
    parser.add_argument("--force", action="store_true", help="Overwrite existing entries")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without writing")
    parser.add_argument("--import", dest="import_path", metavar="PATH", help="Import hand_spells.json")
    args = parser.parse_args()

    db.init_db()

    if args.import_path:
        totals = _import_hand_spells(Path(args.import_path), args.dry_run)
        print(
            f"\nImport done: seeded={totals['seeded']} "
            f"skipped={totals['skipped']} failed={totals['failed']}"
        )
        return

    wishes = _load_wishes(WISHES_FILE)
    print(f"Loaded {len(wishes)} wishes from {WISHES_FILE}")
    totals = await _seed_wishes(
        wishes,
        offline=args.offline,
        force=args.force,
        dry_run=args.dry_run,
        limit=args.limit,
    )
    print(
        f"\nDone: seeded={totals['seeded']} skipped={totals['skipped']} "
        f"failed={totals['failed']} tokens={totals['tokens']}"
    )


if __name__ == "__main__":
    asyncio.run(main())

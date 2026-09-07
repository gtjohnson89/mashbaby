"""Rate limits + LLM spend ceiling for public hosting. In-process, single-worker."""

from __future__ import annotations

import json
import math
import os
import time
from collections import deque
from datetime import datetime, timezone

from fastapi import Request

ALLOWED_ORIGINS_RAW = os.getenv("MASH_ALLOWED_ORIGINS", "")


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


WISH_PER_HOUR = _env_int("MASH_WISH_PER_HOUR", 120)
LLM_PER_HOUR = _env_int("MASH_LLM_PER_HOUR", 12)
LLM_PER_DAY_GLOBAL = _env_int("MASH_LLM_PER_DAY_GLOBAL", 500)
MAX_SPEC_BYTES = _env_int("MASH_MAX_SPEC_BYTES", 24576)


class SlidingWindow:
    """Per-key timestamp deque, trimmed to `window_seconds`."""

    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = {}

    def _prune(self, key: str, now: float) -> deque[float]:
        hits = self._hits.get(key)
        if hits is None:
            hits = deque()
            self._hits[key] = hits
        while hits and now - hits[0] >= self.window_seconds:
            hits.popleft()
        return hits

    def check(self, key: str) -> bool:
        now = time.monotonic()
        hits = self._prune(key, now)
        if len(hits) >= self.limit:
            if len(self._hits) > 10_000:
                for k in list(self._hits):
                    if not self._hits[k]:
                        del self._hits[k]
            return False
        hits.append(now)
        if len(self._hits) > 10_000:
            for k in list(self._hits):
                if not self._hits[k]:
                    del self._hits[k]
        return True

    def retry_after(self, key: str) -> int:
        now = time.monotonic()
        hits = self._prune(key, now)
        if not hits:
            return 1
        wait = self.window_seconds - (now - hits[0])
        return max(1, math.ceil(wait))


class DailyBudget:
    """Global LLM call ceiling, resets at UTC midnight."""

    def __init__(self, limit: int) -> None:
        self.limit = limit
        self._day = datetime.now(timezone.utc).date()
        self._count = 0

    def _reset_if_needed(self) -> None:
        today = datetime.now(timezone.utc).date()
        if today != self._day:
            self._day = today
            self._count = 0

    def check_and_spend(self) -> bool:
        self._reset_if_needed()
        if self._count >= self.limit:
            return False
        self._count += 1
        return True

    def remaining(self) -> int:
        self._reset_if_needed()
        return max(0, self.limit - self._count)


SAVE_PER_HOUR = _env_int("MASH_SAVE_PER_HOUR", 30)

wish_window = SlidingWindow(WISH_PER_HOUR, 3600)
llm_window = SlidingWindow(LLM_PER_HOUR, 3600)
save_window = SlidingWindow(SAVE_PER_HOUR, 3600)
llm_budget = DailyBudget(LLM_PER_DAY_GLOBAL)


def client_ip(request: Request) -> str:
    """Left-most X-Forwarded-For entry when behind a proxy, else request.client.host."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def allowed_origins() -> list[str]:
    origins = [o.strip() for o in ALLOWED_ORIGINS_RAW.split(",") if o.strip()]
    if origins:
        return origins
    return [
        "http://127.0.0.1:8787",
        "http://localhost:8787",
        "http://127.0.0.1:8765",
        "http://localhost:8765",
    ]


def spec_too_big(spec: dict) -> bool:
    try:
        return len(json.dumps(spec)) > MAX_SPEC_BYTES
    except (TypeError, ValueError):
        return True

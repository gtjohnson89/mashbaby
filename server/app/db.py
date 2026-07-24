"""SQLite-backed mash sessions (swap DATABASE_URL later for Postgres)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import DateTime, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session, sessionmaker

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "server" / "mash.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class MashSession(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    spec_json: Mapped[str] = mapped_column(Text)
    history_json: Mapped[str] = mapped_column(Text, default="[]")
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)


def new_session(spec: dict[str, Any] | None = None) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    sid = uuid.uuid4().hex[:12]
    empty = spec or {
        "id": "empty",
        "title": "Describe your game",
        "brand": "mashbaby",
        "copy": "Tell us what to mash!",
        "theme": {
            "wallColor": "#2a3040",
            "wallDotColors": ["#7ec8ff", "#ff9ec5"],
            "floorColor": "#e8d5b5",
            "accent": "#5ab0ff",
            "gateBtnFrom": "#5ab0ff",
            "gateBtnTo": "#ff6b9d",
        },
        "scene": {"template": "blank-room", "props": {}},
        "onMash": [{"kind": "star", "weight": 100}],
        "actors": [],
        "ambient": [],
        "limits": {"maxSpawns": 16, "spawnCooldownMs": 90},
        "customEntities": {},
    }
    with SessionLocal() as db:
        row = MashSession(
            id=sid,
            created_at=now,
            updated_at=now,
            spec_json=json.dumps(empty),
            history_json="[]",
            total_tokens=0,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _public(row)


def get_session(session_id: str) -> dict[str, Any] | None:
    with SessionLocal() as db:
        row = db.get(MashSession, session_id)
        if not row:
            return None
        return _public(row)


def update_session(
    session_id: str,
    *,
    spec: dict[str, Any],
    history_entry: dict[str, Any] | None = None,
    tokens_delta: int = 0,
) -> dict[str, Any] | None:
    with SessionLocal() as db:
        row = db.get(MashSession, session_id)
        if not row:
            return None
        row.spec_json = json.dumps(spec)
        row.updated_at = datetime.now(timezone.utc)
        row.total_tokens = (row.total_tokens or 0) + tokens_delta
        if history_entry:
            history = json.loads(row.history_json or "[]")
            history.append(history_entry)
            row.history_json = json.dumps(history[-50:])
        db.commit()
        db.refresh(row)
        return _public(row)


def _public(row: MashSession) -> dict[str, Any]:
    return {
        "id": row.id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "spec": json.loads(row.spec_json),
        "history": json.loads(row.history_json or "[]"),
        "usage": {"total_tokens": row.total_tokens or 0},
    }

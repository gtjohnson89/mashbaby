"""mashbaby API — sessions, prompt, tweak, play."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db, grok, spellbook
from .catalog import glossary
from .grok import apply_patch_with_palette, generate_patch, invent_or_patch
from .limits import (
    allowed_origins,
    client_ip,
    llm_budget,
    llm_window,
    spec_too_big,
    wish_window,
)
from .patches import apply_tweak, build_from_prompt

ROOT = Path(__file__).resolve().parents[2]

app = FastAPI(title="mashbaby", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Mash-License"],
)


class PromptBody(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class TweakBody(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class WishBody(BaseModel):
    """Stateless parent wish — coffee-table play without a Studio session."""

    text: str = Field(min_length=1, max_length=400)
    spec: dict[str, Any]


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


@app.get("/api/health")
def health() -> dict[str, Any]:
    stats = db.spell_stats()
    return {
        "status": "ok",
        "llm_budget_remaining": llm_budget.remaining(),
        "spellbook_count": stats["count"],
    }


@app.get("/api/catalog")
def api_catalog() -> dict[str, Any]:
    return glossary()


@app.post("/api/wish")
async def wish_patch(request: Request, body: WishBody) -> dict[str, Any]:
    """
    Instant catalog floor + generative soul against an inline GameSpec.
    Same path as session tweak, without accounts / session storage.
    Tweaks are free; novel creations are flagged so the client can spend jar credits.
    """
    ip = client_ip(request)

    if spec_too_big(body.spec):
        raise HTTPException(413, "That game got too big to wish on.")

    if not wish_window.check(ip):
        raise HTTPException(
            status_code=429,
            detail="Too many wishes right now — take a mash break and try again soon.",
            headers={"Retry-After": str(wish_window.retry_after(ip))},
        )

    new_spec, intent, usage = apply_tweak(body.spec, body.text)
    note = "Updated!"
    novel = False

    if intent == "freewheel":
        cached = spellbook.lookup(body.text)
        if cached:
            new_spec = apply_patch_with_palette(body.spec, cached["patch"])
            note = cached["note"]
            usage = {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
                "path": "spellbook",
                "novel": True,
            }
        elif llm_window.check(ip) and llm_budget.check_and_spend():
            patch, usage, note = await generate_patch(
                spec=body.spec,
                text=body.text,
                history=[],
            )
            new_spec = apply_patch_with_palette(body.spec, patch)
            source = "grok" if usage.get("path") == "grok" else "offline"
            spellbook.remember(body.text, patch, note, source=source)
        else:
            new_spec, usage, note = grok._offline_freewheel(body.spec, body.text)
            usage["path"] = "rate_limited_offline"
            note = "The wish wizard needs a little rest — here's some offline magic! Try again in a bit."
        intent = "freewheel"
        novel = True
    elif intent == "theme":
        note = "Pinker? Bluer? Done — colors changed!"
    elif intent == "palette":
        note = "Whoosh — a whole new world!"
    elif intent == "ambient":
        note = "Something floated into the sky!"
    elif intent == "catalog_add":
        note = "Added it to the mash mix!"
    elif intent == "more":
        note = "More of that — coming right up!"
    elif intent == "full_rethink":
        note = "Started a fresh game from that idea."
        novel = True

    usage = {**usage, "novel": novel or bool(usage.get("novel"))}
    return {
        "spec": new_spec,
        "intent": intent,
        "note": note,
        "novel": usage["novel"],
        "turn_usage": usage,
    }


@app.post("/api/session")
def create_session() -> dict[str, Any]:
    return db.new_session()


@app.get("/api/session/{session_id}")
def get_session(session_id: str) -> dict[str, Any]:
    row = db.get_session(session_id)
    if not row:
        raise HTTPException(404, "Session not found")
    return row


@app.post("/api/session/{session_id}/prompt")
async def prompt_session(session_id: str, request: Request, body: PromptBody) -> dict[str, Any]:
    row = db.get_session(session_id)
    if not row:
        raise HTTPException(404, "Session not found")

    ip = client_ip(request)
    if not wish_window.check(ip):
        raise HTTPException(
            status_code=429,
            detail="Too many wishes right now — take a mash break and try again soon.",
            headers={"Retry-After": str(wish_window.retry_after(ip))},
        )

    spec = build_from_prompt(body.text)
    usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "path": "deterministic"}
    note = f"Built “{spec['title']}” from your description."

    # If prompt has leftover freewheel vibes with no catalog hits beyond template, that's ok
    updated = db.update_session(
        session_id,
        spec=spec,
        history_entry={"role": "user", "text": body.text, "intent": "prompt", "note": note},
        tokens_delta=usage["total_tokens"],
    )
    assert updated
    return {**updated, "intent": "prompt", "note": note, "turn_usage": usage}


@app.post("/api/session/{session_id}/tweak")
async def tweak_session(session_id: str, request: Request, body: TweakBody) -> dict[str, Any]:
    row = db.get_session(session_id)
    if not row:
        raise HTTPException(404, "Session not found")

    spec = row["spec"]
    new_spec, intent, usage = apply_tweak(spec, body.text)
    note = "Updated!"

    if intent == "freewheel":
        ip = client_ip(request)
        if llm_window.check(ip) and llm_budget.check_and_spend():
            new_spec, usage, note = await invent_or_patch(
                spec=spec,
                text=body.text,
                history=[{"text": h.get("text", ""), "intent": h.get("intent", "")} for h in row.get("history", [])],
            )
        else:
            new_spec, usage, note = grok._offline_freewheel(spec, body.text)
            usage["path"] = "rate_limited_offline"
            note = "The wish wizard needs a little rest — here's some offline magic! Try again in a bit."
        intent = "freewheel"
    elif intent == "theme":
        note = "Changed the colors."
    elif intent == "palette":
        note = "Whoosh — a whole new world!"
    elif intent == "ambient":
        note = "Added something in the sky/background."
    elif intent == "catalog_add":
        note = "Added it to the mash mix!"
    elif intent == "more":
        note = "More of that!"
    elif intent == "full_rethink":
        note = "Started a fresh game from that idea."

    updated = db.update_session(
        session_id,
        spec=new_spec,
        history_entry={
            "role": "user",
            "text": body.text,
            "intent": intent,
            "note": note,
            "usage": usage,
        },
        tokens_delta=int(usage.get("total_tokens") or 0),
    )
    assert updated
    return {**updated, "intent": intent, "note": note, "turn_usage": usage}


# Static mounts
app.mount("/engine", StaticFiles(directory=ROOT / "engine"), name="engine")
app.mount("/specs", StaticFiles(directory=ROOT / "specs"), name="specs")
app.mount("/games", StaticFiles(directory=ROOT / "games"), name="games")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(ROOT / "index.html")


@app.get("/styles.css")
def styles() -> FileResponse:
    return FileResponse(ROOT / "styles.css")


@app.get("/studio")
@app.get("/studio/")
def studio() -> FileResponse:
    return FileResponse(ROOT / "studio" / "index.html")


@app.get("/studio/{path:path}")
def studio_assets(path: str) -> FileResponse:
    file = ROOT / "studio" / path
    if not file.is_file():
        raise HTTPException(404)
    return FileResponse(file)


@app.get("/play/{session_id}")
def play_redirect(session_id: str) -> FileResponse:
    # play.html reads ?session=
    return FileResponse(ROOT / "engine" / "play.html")

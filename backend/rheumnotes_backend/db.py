"""Supabase clients and the content_events audit log."""
from __future__ import annotations

import getpass
import logging
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
log = logging.getLogger("rheumnotes.backend")


def _env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is not set; copy backend/.env.example to backend/.env")
    return value


@lru_cache(maxsize=1)
def service_client() -> Client:
    """Full access, bypasses RLS. Scripts only, never the app."""
    return create_client(_env("SUPABASE_URL"), _env("SUPABASE_SERVICE_ROLE_KEY"))


@lru_cache(maxsize=1)
def anon_client() -> Client:
    """Same permissions as the patient app."""
    return create_client(_env("SUPABASE_URL"), _env("SUPABASE_ANON_KEY"))


def log_event(action: str, outcome: str, message: str = "", lesson_id: str | None = None,
              version: int | None = None) -> None:
    level = logging.INFO if outcome == "ok" else logging.WARNING
    log.log(level, "%s %s %s v%s: %s", action, outcome, lesson_id or "-", version or "-", message)
    service_client().table("content_events").insert({
        "actor": os.environ.get("RHEUMNOTES_ACTOR") or getpass.getuser(),
        "action": action, "outcome": outcome, "message": message,
        "lesson_id": lesson_id, "version": version,
    }).execute()

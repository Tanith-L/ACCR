"""Automatic per-lesson checks. They decide whether a lesson exports as
'checked' (goes on Dr. Murphy's review sheet) or 'draft' (back to the Data Lead).

Add a check by writing a function `(lesson, ctx) -> (passed, detail)` and
listing it in CHECKS.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .paths import MEDIA_DIR


@dataclass
class CheckContext:
    source_ids: set[str]
    media_dir: Path = MEDIA_DIR


CheckFn = Callable[[dict, CheckContext], tuple[bool, str | None]]


def has_source_refs(lesson: dict, ctx: CheckContext):
    refs = lesson.get("source_refs", [])
    missing = [r["source_id"] for r in refs if r["source_id"] not in ctx.source_ids]
    if not refs:
        return False, "lesson cites no sources"
    if missing:
        return False, f"unknown sources: {missing}"
    return True, None


def claims_supported(lesson: dict, ctx: CheckContext):
    claims = lesson.get("claims", [])
    unsupported = [c["text"] for c in claims if c.get("supported") is False]
    unverified = [c["text"] for c in claims if c.get("supported") is None]
    if not claims:
        return False, "no claims extracted, so nothing could be verified"
    if unsupported:
        return False, f"{len(unsupported)} unsupported claim(s): {unsupported[:2]}"
    if unverified:
        return False, f"{len(unverified)} claim(s) not yet verified against sources"
    return True, f"{len(claims)} claim(s) verified"


def images_exist(lesson: dict, ctx: CheckContext):
    missing = [i["file"] for i in lesson.get("images", []) if not (ctx.media_dir / i["file"]).exists()]
    return (not missing), (f"missing media: {missing}" if missing else None)


def readable_length(lesson: dict, ctx: CheckContext):
    # Patient-friendly target: short sentences. Tune thresholds with Dr. Murphy.
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", lesson["body_markdown"]) if s.strip()]
    if not sentences:
        return False, "empty body"
    avg = sum(len(s.split()) for s in sentences) / len(sentences)
    return avg <= 25, f"average sentence length {avg:.1f} words"


def quiz_well_formed(lesson: dict, ctx: CheckContext):
    bad = [q["id"] for q in lesson.get("quiz", []) if not 0 <= q["answer"] < len(q["options"])]
    return (not bad), (f"bad answer index: {bad}" if bad else None)


CHECKS: dict[str, CheckFn] = {
    "has_source_refs": has_source_refs,
    "claims_supported": claims_supported,
    "images_exist": images_exist,
    "readable_length": readable_length,
    "quiz_well_formed": quiz_well_formed,
}


def run_checks(lesson: dict, ctx: CheckContext) -> dict:
    """Return a copy of the lesson with `checks` filled in and `status` set."""
    results = []
    for name, fn in CHECKS.items():
        passed, detail = fn(lesson, ctx)
        results.append({"name": name, "passed": bool(passed), "detail": detail})
    status = "checked" if all(r["passed"] for r in results) else "draft"
    return {**lesson, "checks": results, "status": status}

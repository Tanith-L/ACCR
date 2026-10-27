"""Convert the hand-written content at the repo root (topics.yaml, lessons/*.md,
quizzes.yaml, media/media.yaml) into a content bundle.

This gives the Backend and Frontend leads real PsA data to build against
before the AI pipeline is finished, and is the "manual structuring" baseline
for the AI-efficiency evaluation.
"""
from __future__ import annotations

import re
import time
from datetime import datetime, timezone
from pathlib import Path

import yaml

from . import SCHEMA_VERSION
from .checks import CheckContext, run_checks
from .paths import LEGACY_LESSONS_DIR, LEGACY_MEDIA, LEGACY_QUIZZES, LEGACY_TOPICS, MEDIA_DIR

_PAGE_RE = re.compile(r"^(?P<title>.+?)\s+pp?\.\s*(?P<pages>[\d,\s-]+)$")


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _expand_pages(spec: str) -> list[int]:
    """'9, 12-13' -> [9, 12, 13]"""
    pages: list[int] = []
    for chunk in (c.strip() for c in spec.split(",")):
        if "-" in chunk:
            lo, hi = (int(x) for x in chunk.split("-"))
            pages.extend(range(lo, hi + 1))
        elif chunk:
            pages.append(int(chunk))
    return pages


def parse_source_string(raw: str) -> list[tuple[str, list[int]]]:
    """'A p.2; B pp.9, 12-13' -> [('A', [2]), ('B', [9, 12, 13])]"""
    out = []
    for part in (p.strip() for p in raw.split(";")):
        if not part:
            continue
        m = _PAGE_RE.match(part.replace('\u2019', "'"))
        out.append((m["title"], _expand_pages(m["pages"])) if m else (part, []))
    return out


def _read_markdown(path: Path) -> tuple[dict, str]:
    text = path.read_text()
    _, front, body = text.split("---", 2)
    return yaml.safe_load(front), body.strip()


def convert(topics_path: Path = LEGACY_TOPICS, lessons_dir: Path = LEGACY_LESSONS_DIR,
            quizzes_path: Path = LEGACY_QUIZZES, media_path: Path = LEGACY_MEDIA,
            media_dir: Path = MEDIA_DIR) -> dict:
    started = datetime.now(timezone.utc)
    t0 = time.monotonic()

    structure = yaml.safe_load(topics_path.read_text())
    media = {m["file"]: m for m in yaml.safe_load(media_path.read_text())}
    quizzes = yaml.safe_load(quizzes_path.read_text()) if quizzes_path.exists() else []

    sources: dict[str, dict] = {}

    def source_id(title: str) -> str:
        sid = slugify(title)
        sources.setdefault(sid, {"id": sid, "title": title, "file": None, "url": None,
                                 "media_type": None, "credit": None})
        return sid

    quiz_by_lesson: dict[str, list[dict]] = {}
    for q in quizzes:
        refs = parse_source_string(q.get("source") or "")
        quiz_by_lesson.setdefault(q["lesson_id"], []).append({
            "id": q["id"], "question": q["question"], "options": q["options"],
            "answer": q["answer"], "feedback": q.get("feedback"),
            "source_id": source_id(refs[0][0]) if refs else None,
        })

    topics, lessons = [], []
    for t in structure["topics"]:
        subtopics = []
        for st in t["subtopics"]:
            subtopics.append({"id": st["id"], "name": st["name"], "order": st["order"],
                              "lesson_ids": list(st["lessons"])})
            for order, lesson_id in enumerate(st["lessons"], start=1):
                meta, body = _read_markdown(lessons_dir / f"{lesson_id}.md")
                refs: dict[str, list[int]] = {}
                for title, pages in parse_source_string(meta.get("source") or ""):
                    known = refs.setdefault(source_id(title), [])
                    known.extend(pg for pg in pages if pg not in known)
                takeaways = meta.get("key_takeaways") or []
                lessons.append({
                    "id": lesson_id,
                    "version": 1,
                    "topic_id": t["id"],
                    "subtopic_id": st["id"],
                    "order": order,
                    "title": meta["title"],
                    "summary": takeaways[0] if takeaways else body.split(". ")[0] + ".",
                    "est_minutes": int(meta.get("est_minutes") or 2),
                    "body_markdown": body,
                    "key_takeaways": takeaways,
                    "images": [{
                        "file": img["file"],
                        "alt_text": media.get(img["file"], {}).get("alt_text") or img["file"],
                        "credit": media.get(img["file"], {}).get("credit"),
                        "page": img.get("page"),
                    } for img in meta.get("images") or []],
                    "source_refs": [{"source_id": sid, "pages": pages, "excerpt": None}
                                    for sid, pages in refs.items()],
                    "status": "draft",
                    "origin": "ai_assisted",
                    # Legacy lessons have no extracted claims yet; the claims check
                    # will keep them as 'draft' until the pipeline adds and verifies them.
                    "claims": [],
                    "checks": [],
                    "quiz": quiz_by_lesson.get(lesson_id, []),
                })
        topics.append({"id": t["id"], "name": t["name"], "order": t["order"],
                       "icon": None if t.get("icon") in (None, "tbd") else t["icon"],
                       "description": t.get("description"), "subtopics": subtopics})

    ctx = CheckContext(source_ids=set(sources), media_dir=media_dir)
    lessons = [run_checks(l, ctx) for l in lessons]

    finished = datetime.now(timezone.utc)
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": finished.isoformat(),
        "pipeline_run": {
            "run_id": f"legacy-{started:%Y%m%dT%H%M%SZ}",
            "mode": "legacy",
            "model": None,
            "prompt_version": None,
            "started_at": started.isoformat(),
            "finished_at": finished.isoformat(),
            "duration_seconds": round(time.monotonic() - t0, 3),
            "source_document_ids": sorted(sources),
            "usage": None,
        },
        "disease": structure["disease"],
        "sources": sorted(sources.values(), key=lambda s: s["id"]),
        "topics": topics,
        "lessons": lessons,
    }

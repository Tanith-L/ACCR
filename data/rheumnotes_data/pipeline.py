"""AI pipeline: source documents -> concepts -> lesson plan -> drafts -> checks -> bundle.

    python -m rheumnotes_data run --topic overview data/sources/*.pdf

Each run writes the bundle plus an `<name>.trace.json` with the intermediate
concepts and plan, which is what the client demo shows side by side with the
original document.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path

import yaml

from . import SCHEMA_VERSION
from .checks import CheckContext, run_checks
from .generator import PROMPT_VERSION, ContentGenerator
from .ingest import SourceDocument
from .paths import LEGACY_TOPICS, MEDIA_DIR


def load_structure(path: Path = LEGACY_TOPICS) -> dict:
    """The predefined RheumNotes knowledge structure (disease -> topics -> subtopics)."""
    return yaml.safe_load(Path(path).read_text())


def _lesson_id(disease_id: str, topic_id: str, n: int) -> str:
    # Stable as long as the plan keeps the same order: psa-overview-01, psa-overview-02, ...
    return f"{disease_id}-{topic_id}-{n:02d}"


def _next_version(previous: dict | None, lesson: dict) -> int:
    """Re-exporting an unchanged lesson keeps its version; a changed one gets +1."""
    if not previous:
        return 1
    old = next((l for l in previous["lessons"] if l["id"] == lesson["id"]), None)
    if old is None:
        return 1
    same = all(old.get(k) == lesson.get(k) for k in ("title", "summary", "body_markdown", "key_takeaways"))
    return old["version"] if same else old["version"] + 1


def run(docs: list[SourceDocument], generator: ContentGenerator, topic_id: str,
        structure: dict | None = None, max_lessons: int = 3,
        previous: dict | None = None, media_dir: Path = MEDIA_DIR) -> tuple[dict, dict]:
    """Returns (bundle, trace)."""
    started = datetime.now(timezone.utc)
    t0 = time.monotonic()
    structure = structure or load_structure()
    disease = structure["disease"]
    topic = next((t for t in structure["topics"] if t["id"] == topic_id), None)
    if topic is None:
        raise ValueError(f"topic {topic_id!r} is not in the knowledge structure")

    docs_by_id = {d.id: d for d in docs}
    concepts = [c for d in docs for c in generator.extract_concepts(d)]
    plan = generator.plan_lessons(topic, concepts, max_lessons)

    valid_subtopics = {st["id"] for st in topic["subtopics"]}
    lessons = []
    for n, item in enumerate(plan.lessons[:max_lessons], start=1):
        if item.subtopic_id not in valid_subtopics:
            item.subtopic_id = topic["subtopics"][0]["id"]
        draft = generator.draft_lesson(item, concepts, docs)
        verdicts = generator.verify_claims(draft.claims, docs_by_id)
        lesson_id = _lesson_id(disease["id"], topic_id, n)

        refs: dict[str, list[int]] = {}
        for c in draft.claims:
            pages = refs.setdefault(c.source_id, [])
            if c.page and c.page not in pages:
                pages.append(c.page)
        lesson = {
            "id": lesson_id,
            "version": 1,
            "topic_id": topic_id,
            "subtopic_id": item.subtopic_id,
            "order": 0,  # set below once lessons are grouped by subtopic
            "title": draft.title,
            "summary": draft.summary,
            "est_minutes": max(1, min(30, draft.est_minutes)),
            "body_markdown": draft.body_markdown,
            "key_takeaways": draft.key_takeaways,
            "images": [],  # TODO(data): match media/media.yaml entries to lessons
            "source_refs": [{"source_id": sid, "pages": sorted(p), "excerpt": None} for sid, p in refs.items()],
            "status": "draft",
            "origin": "ai_generated",
            "claims": [{"text": c.text, "source_id": c.source_id, "page": c.page, "supported": ok}
                       for c, ok in zip(draft.claims, verdicts)],
            "checks": [],
            "quiz": [{"id": f"{lesson_id}-q{i}", "question": q.question, "options": q.options,
                      "answer": q.answer, "feedback": q.feedback,
                      "source_id": draft.claims[0].source_id if draft.claims else None}
                     for i, q in enumerate(draft.quiz, start=1)],
        }
        lesson["version"] = _next_version(previous, lesson)
        lessons.append(lesson)

    subtopics = []
    for st in topic["subtopics"]:
        ids = [l["id"] for l in lessons if l["subtopic_id"] == st["id"]]
        for order, lid in enumerate(ids, start=1):
            next(l for l in lessons if l["id"] == lid)["order"] = order
        if ids:
            subtopics.append({"id": st["id"], "name": st["name"], "order": len(subtopics) + 1,
                              "lesson_ids": ids})

    ctx = CheckContext(source_ids=set(docs_by_id), media_dir=media_dir)
    lessons = [run_checks(l, ctx) for l in lessons]

    finished = datetime.now(timezone.utc)
    bundle = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": finished.isoformat(),
        "pipeline_run": {
            "run_id": f"ai-{started:%Y%m%dT%H%M%SZ}",
            "mode": "ai",
            "model": generator.model,
            "prompt_version": PROMPT_VERSION,
            "started_at": started.isoformat(),
            "finished_at": finished.isoformat(),
            "duration_seconds": round(time.monotonic() - t0, 3),
            "source_document_ids": sorted(docs_by_id),
            "usage": getattr(generator, "usage", None),
        },
        "disease": disease,
        "sources": [d.as_source_record() for d in docs],
        "topics": [{"id": topic["id"], "name": topic["name"], "order": 1,
                    "icon": None if topic.get("icon") in (None, "tbd") else topic["icon"],
                    "description": topic.get("description"), "subtopics": subtopics}],
        "lessons": lessons,
    }
    trace = {"concepts": [c.model_dump() for c in concepts], "plan": plan.model_dump()}
    return bundle, trace


def write_bundle(bundle: dict, path: Path, trace: dict | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(bundle, indent=2, ensure_ascii=False) + "\n")
    if trace is not None:
        path.with_suffix(".trace.json").write_text(json.dumps(trace, indent=2, ensure_ascii=False) + "\n")

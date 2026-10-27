"""Import a Data-pipeline bundle into Supabase.

Validates first (same validator the Data Lead uses), then upserts structure
and inserts each lesson version. Re-importing the same bundle is a no-op;
a changed lesson must arrive with a higher version number.
"""
from __future__ import annotations

import json
from pathlib import Path

from rheumnotes_data.validate import validate_bundle

from .db import log_event, service_client

# Bundle field -> lesson_versions column. Everything else maps 1:1 by name.
LESSON_VERSION_FIELDS = {
    "title": "title", "summary": "summary", "body_markdown": "body_markdown",
    "est_minutes": "est_minutes", "key_takeaways": "key_takeaways", "images": "images",
    "source_refs": "source_refs", "quiz": "quiz", "status": "status", "origin": "origin",
    "claims": "claims", "checks": "check_results",
}
CONTENT_FIELDS = ("title", "summary", "body_markdown", "key_takeaways", "source_refs", "quiz")


class ImportErrorReport(Exception):
    pass


def bundle_to_rows(bundle: dict) -> dict[str, list[dict]]:
    """Pure mapping from bundle JSON to table rows (unit-testable without a database)."""
    run = bundle["pipeline_run"]
    rows: dict[str, list[dict]] = {
        "diseases": [bundle["disease"]],
        "sources": bundle["sources"],
        "pipeline_runs": [{k: run.get(k) for k in (
            "run_id", "mode", "model", "prompt_version", "started_at", "finished_at",
            "duration_seconds", "source_document_ids", "usage")}],
        "topics": [], "subtopics": [], "lessons": [], "lesson_versions": [],
    }
    for t in bundle["topics"]:
        rows["topics"].append({"id": t["id"], "disease_id": bundle["disease"]["id"], "name": t["name"],
                               "order_index": t["order"], "icon": t.get("icon"),
                               "description": t.get("description")})
        for st in t["subtopics"]:
            rows["subtopics"].append({"id": st["id"], "topic_id": t["id"], "name": st["name"],
                                      "order_index": st["order"]})
    for l in bundle["lessons"]:
        rows["lessons"].append({"id": l["id"], "topic_id": l["topic_id"], "subtopic_id": l["subtopic_id"],
                                "order_index": l["order"]})
        version = {col: l[field] for field, col in LESSON_VERSION_FIELDS.items()}
        version.update(lesson_id=l["id"], version=l["version"], run_id=run["run_id"])
        rows["lesson_versions"].append(version)
    return rows


def import_bundle(path: Path, dry_run: bool = False) -> dict[str, int]:
    bundle = json.loads(Path(path).read_text())
    report = validate_bundle(bundle)
    if not report.ok:
        if not dry_run:
            log_event("import", "rejected", f"{Path(path).name} failed validation")
        raise ImportErrorReport(report.summary())

    rows = bundle_to_rows(bundle)
    if dry_run:
        return {table: len(r) for table, r in rows.items()}

    db = service_client()
    for table in ("diseases", "sources", "pipeline_runs", "topics", "subtopics", "lessons"):
        if rows[table]:
            db.table(table).upsert(rows[table]).execute()

    counts = {"inserted": 0, "unchanged": 0, "rejected": 0}
    for row in rows["lesson_versions"]:
        existing = (db.table("lesson_versions").select(",".join(CONTENT_FIELDS) + ",status")
                    .eq("lesson_id", row["lesson_id"]).eq("version", row["version"]).execute().data)
        if existing:
            if all(existing[0][f] == row[f] for f in CONTENT_FIELDS):
                counts["unchanged"] += 1
            else:
                counts["rejected"] += 1
                log_event("import", "rejected", "content changed without a version bump",
                          row["lesson_id"], row["version"])
            continue
        db.table("lesson_versions").insert(row).execute()
        counts["inserted"] += 1
        log_event("import", "ok", f"status={row['status']} run={row['run_id']}",
                  row["lesson_id"], row["version"])
    return counts

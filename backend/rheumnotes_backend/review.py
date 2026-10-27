"""Clinical review round-trip and publishing.

1. export_review_sheet: every `checked` lesson version -> CSV for Dr. Murphy.
   Drafts are never on the sheet.
2. import_review_sheet: reads the scored CSV.
     pass    + checked      -> reviewed, scores saved
     revise  + checked      -> stays checked, comment logged for the Data Lead
     anything not checked   -> row rejected and logged
3. publish: reviewed -> published, nothing else.

The database trigger enforces the same transitions, so these checks are a
friendly first line, not the only one.
"""
from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path

from .db import log_event, service_client

# TODO(backend): confirm Rubric B criteria and scale (1-5?) with Dr. Murphy.
RUBRIC_B = ("accuracy", "clarity", "completeness", "patient_safety")
SHEET_COLUMNS = ("lesson_id", "version", "title", "summary", "body_markdown", "sources",
                 "claims", *(f"score_{c}" for c in RUBRIC_B), "decision", "comment", "reviewer")


def export_review_sheet(out_dir: Path) -> Path:
    rows = (service_client().table("lesson_versions")
            .select("lesson_id,version,title,summary,body_markdown,source_refs,claims")
            .eq("status", "checked").order("lesson_id").order("version").execute().data)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"review_sheet_{datetime.now(timezone.utc):%Y%m%d}.csv"
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=SHEET_COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow({
                "lesson_id": r["lesson_id"], "version": r["version"], "title": r["title"],
                "summary": r["summary"], "body_markdown": r["body_markdown"],
                "sources": "; ".join(f"{s['source_id']} p.{','.join(map(str, s['pages']))}"
                                     for s in r["source_refs"]),
                "claims": "\n".join(f"- {c['text']} [{c['source_id']} p.{c.get('page')}]" for c in r["claims"]),
            })
    return path


def import_review_sheet(path: Path) -> dict[str, int]:
    db = service_client()
    counts = {"reviewed": 0, "revise": 0, "rejected": 0}
    with Path(path).open(newline="") as f:
        for row in csv.DictReader(f):
            lesson_id, version = row["lesson_id"], int(row["version"])
            decision = (row.get("decision") or "").strip().lower()
            found = (db.table("lesson_versions").select("status")
                     .eq("lesson_id", lesson_id).eq("version", version).execute().data)
            if not found:
                counts["rejected"] += 1
                log_event("review", "rejected", "no such lesson version", lesson_id, version)
                continue
            if found[0]["status"] != "checked":
                counts["rejected"] += 1
                log_event("review", "rejected", f"status is {found[0]['status']}, only checked can be reviewed",
                          lesson_id, version)
                continue

            if decision == "pass":
                scores = {c: _score(row.get(f"score_{c}")) for c in RUBRIC_B}
                db.table("lesson_versions").update({
                    "status": "reviewed", "review_scores": scores,
                    "reviewer": row.get("reviewer") or None, "review_comment": row.get("comment") or None,
                }).eq("lesson_id", lesson_id).eq("version", version).execute()
                counts["reviewed"] += 1
                log_event("review", "ok", f"pass {scores}", lesson_id, version)
            elif decision == "revise":
                db.table("lesson_versions").update({"review_comment": row.get("comment") or None}) \
                    .eq("lesson_id", lesson_id).eq("version", version).execute()
                counts["revise"] += 1
                log_event("review", "revise", row.get("comment") or "", lesson_id, version)
            else:
                counts["rejected"] += 1
                log_event("review", "rejected", f"unknown decision {decision!r}", lesson_id, version)
    return counts


def _score(value: str | None) -> int | None:
    try:
        return int(value) if value not in (None, "") else None
    except ValueError:
        return None


def publish(lesson_ids: list[str] | None = None) -> dict[str, int]:
    """Publish reviewed versions. With no ids, publishes every reviewed version."""
    db = service_client()
    query = db.table("lesson_versions").select("lesson_id,version,status")
    query = query.in_("lesson_id", lesson_ids) if lesson_ids else query.eq("status", "reviewed")
    rows = query.execute().data
    if lesson_ids:
        # Only the newest version of each named lesson is a publish candidate.
        latest: dict[str, dict] = {}
        for r in rows:
            if r["version"] > latest.get(r["lesson_id"], {"version": 0})["version"]:
                latest[r["lesson_id"]] = r
        rows = list(latest.values())
    counts = {"published": 0, "rejected": 0}
    for r in rows:
        if r["status"] == "published":
            continue
        if r["status"] != "reviewed":
            counts["rejected"] += 1
            log_event("publish", "rejected", f"status is {r['status']}", r["lesson_id"], r["version"])
            continue
        db.table("lesson_versions").update({"status": "published"}) \
            .eq("lesson_id", r["lesson_id"]).eq("version", r["version"]).execute()
        counts["published"] += 1
        log_event("publish", "ok", "", r["lesson_id"], r["version"])
    return counts

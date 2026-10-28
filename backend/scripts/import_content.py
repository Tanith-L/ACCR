"""B1: import an export JSON into Supabase (week 9 plan §5).

    python backend/scripts/import_content.py exports/export_psa_20261028_a.json [--dry-run]

The file is validated first and any error rejects all of it. Images are uploaded to
Storage, then every row is written in ONE database transaction; if anything fails,
nothing is written. --dry-run runs the same checks and versioning decisions and prints
the report without uploading or writing (add --from-db to compare against the stored
versions, read-only).

Settings (environment or .env): SUPABASE_DB_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import sys
from collections import Counter
from pathlib import Path

from convert_repo_content import find_upwards, validate_export

MAX_MEDIA_BYTES = 500 * 1024
FK_GRADE_MAX = 8
EDITABLE = ("draft", "checked")  # latest versions that are updated in place
BUCKET = "media"


class ImportRejected(Exception):
    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


# --- §5.2 status gate -------------------------------------------------------

def gate_failures(checks: dict) -> list[str]:
    """Why a lesson cannot be `checked`; empty list = passes. Missing fields fail."""
    failures = []
    if checks.get("schema_valid") is not True:
        failures.append("schema_valid is not true")
    if checks.get("citation_accuracy") != 1:
        failures.append(f"citation_accuracy is {checks.get('citation_accuracy')}, not 1")
    for key in ("unsupported", "contradicted"):
        if checks.get(key) != 0:
            failures.append(f"{key} is {checks.get(key)}, not 0")
    if checks.get("numbers_ok") is not True:
        failures.append("numbers_ok is not true")
    if checks.get("safety_flags") != []:
        failures.append(f"safety_flags: {checks.get('safety_flags')}")
    fk = checks.get("fk_grade")
    if fk is None or fk > FK_GRADE_MAX:
        failures.append(f"fk_grade is {fk}, above {FK_GRADE_MAX}")
    return failures


def effective_status(lesson: dict) -> tuple[str, list[str]]:
    """The status the lesson will be imported with, and the gate failures if downgraded."""
    if lesson["status"] != "checked":
        return "draft", []
    failures = gate_failures(lesson["checks"])
    return ("draft", failures) if failures else ("checked", [])


# --- §5.3 versioning --------------------------------------------------------

def content_hash(lesson: dict, quizzes: list[dict]) -> str:
    """SHA-256 of title, minutes, pages, takeaways, images and quiz items."""
    payload = {
        "title": lesson["title"],
        "est_minutes": lesson["est_minutes"],
        "pages": [{"order": p["order"], "body": p["body"]} for p in lesson["pages"]],
        "key_takeaways": lesson["key_takeaways"],
        "images": sorted(
            ({"media_id": i["media_id"], "page": i["page"]} for i in lesson.get("images", [])),
            key=lambda i: (i["page"], i["media_id"]),
        ),
        "quiz_items": sorted(
            (
                {k: q[k] for k in ("id", "question", "options", "answer", "feedback")}
                for q in quizzes
            ),
            key=lambda q: q["id"],
        ),
    }
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def evidence_hash(lesson: dict, status: str) -> str:
    """SHA-256 of what is not patient-facing: claims, checks and the imported status.
    Only used to spot evidence changes on a draft/checked version."""
    payload = {"claims": lesson["claims"], "checks": lesson["checks"], "status": status}
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def decide(latest: dict | None, new_hash: str, new_evidence: str | None = None) -> tuple[str, int]:
    """(action, version) for one lesson given its latest existing version, if any.

    Same patient-facing content is skipped, except on a draft/checked version whose
    claims, checks or status changed: that is updated in place. Reviewed, published
    and archived versions are never touched by an evidence-only change."""
    if latest is None:
        return "insert", 1
    if latest["content_hash"] == new_hash:
        if latest["status"] in EDITABLE and latest.get("evidence_hash") != new_evidence:
            return "update", latest["version"]
        return "skip", latest["version"]
    if latest["status"] in EDITABLE:
        return "update", latest["version"]
    return "insert", latest["version"] + 1  # reviewed / published / archived stay untouched


def plan_lessons(data: dict, existing: dict[str, dict]) -> list[dict]:
    """One entry per lesson. `existing` maps lesson id -> latest version
    {"version", "status", "content_hash", "evidence_hash"}."""
    quizzes: dict[str, list[dict]] = {}
    for q in data["quizzes"]:
        quizzes.setdefault(q["lesson_id"], []).append(q)
    sort_order = {i: n for t in data["topics"] for s in t["subtopics"] for n, i in enumerate(s["lesson_ids"], 1)}

    plan = []
    for lesson in data["lessons"]:
        status, failures = effective_status(lesson)
        h = content_hash(lesson, quizzes.get(lesson["id"], []))
        e = evidence_hash(lesson, status)
        latest = existing.get(lesson["id"])
        action, version = decide(latest, h, e)
        plan.append({
            "id": lesson["id"], "action": action, "version": version, "status": status,
            "evidence_only": action == "update" and latest["content_hash"] == h,
            "evidence_hash": e,
            "downgraded": bool(failures), "gate_failures": failures,
            "content_hash": h, "sort_order": sort_order[lesson["id"]],
            "claims": len(lesson["claims"]), "quizzes": len(quizzes.get(lesson["id"], [])),
        })
    return plan


# --- §5.1 / §5.5 file checks ------------------------------------------------

def media_errors(data: dict, media_dir: Path) -> list[str]:
    errors = []
    for m in data["media"]:
        path = media_dir / m["file"]
        if not path.is_file():
            errors.append(f"media {m['id']}: file {m['file']} not found in {media_dir}")
        elif path.stat().st_size >= MAX_MEDIA_BYTES:
            errors.append(f"media {m['id']}: {m['file']} is {path.stat().st_size} bytes (limit < {MAX_MEDIA_BYTES})")
    return errors


def load_and_validate(path: Path, schema: dict, media_dir: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise ImportRejected([f"cannot read {path}: {e}"]) from e
    errors = validate_export(data, schema)
    if not errors:
        errors = media_errors(data, media_dir)
    if errors:
        raise ImportRejected(errors)
    return data


# --- report -----------------------------------------------------------------

def build_report(data: dict, plan: list[dict]) -> dict:
    counts = Counter(p["action"] for p in plan)
    return {
        "run_id": data["run"]["run_id"],
        "inserted": counts["insert"],
        "updated": counts["update"],
        "updated_evidence_only": sum(p["evidence_only"] for p in plan),
        "skipped": counts["skip"],
        "downgraded": sum(p["downgraded"] for p in plan),
        "topics": len(data["topics"]),
        "subtopics": sum(len(t["subtopics"]) for t in data["topics"]),
        "claims": sum(p["claims"] for p in plan if p["action"] != "skip"),
        "quiz_items": sum(p["quizzes"] for p in plan if p["action"] != "skip"),
        "media_uploads": len(data["media"]),
    }


def format_report(report: dict, plan: list[dict]) -> str:
    lines = [
        f"run {report['run_id']}: lessons inserted {report['inserted']}, updated {report['updated']} "
        f"({report['updated_evidence_only']} evidence only), "
        f"skipped {report['skipped']}, downgraded to draft {report['downgraded']}",
        f"topics {report['topics']}, subtopics {report['subtopics']}, claims {report['claims']}, "
        f"quiz items {report['quiz_items']}, media uploads {report['media_uploads']}",
    ]
    for p in plan:
        note = " (claims/checks/status only)" if p["evidence_only"] else ""
        lines.append(f"  {p['id']} v{p['version']}: {p['action']} as {p['status']}{note}")
        for f in p["gate_failures"]:
            lines.append(f"      downgraded: {f}")
    return "\n".join(lines)


# --- §5.4 / §5.6 database layer ---------------------------------------------
# Functions take an open psycopg connection and never commit on their own: the
# caller owns the outer transaction, so tests can roll everything back.

def fetch_existing(conn, lesson_ids: list[str]) -> dict[str, dict]:
    """Latest stored version of each lesson: {id: {version, status, content_hash, evidence_hash}}."""
    rows = conn.execute(
        "select distinct on (id) id, version, status::text, content_hash, evidence_hash "
        "from lessons where id = any(%s) order by id, version desc",
        (list(lesson_ids),),
    ).fetchall()
    return {r[0]: {"version": r[1], "status": r[2], "content_hash": r[3], "evidence_hash": r[4]} for r in rows}


def unique_run_id(conn, run_id: str) -> str:
    """import_runs.run_id is the primary key; a repeat import of the same file gets -2, -3, ..."""
    taken = {r[0] for r in conn.execute(
        "select run_id from import_runs where run_id = %s or run_id like %s", (run_id, run_id + "-%")).fetchall()}
    candidate, n = run_id, 1
    while candidate in taken:
        n += 1
        candidate = f"{run_id}-{n}"
    return candidate


def storage_path(media: dict) -> str:
    return f"{media['id']}{Path(media['file']).suffix.lower()}"


def write_import(conn, data: dict, plan: list[dict], file_name: str) -> dict:
    """Write one export in a single (nested) transaction. Returns {"run_id", "notes"}."""
    from psycopg.types.json import Jsonb

    plan_by_id = {p["id"]: p for p in plan}
    counts = Counter(p["action"] for p in plan)
    notes = [f"{p['id']}: downgraded to draft ({'; '.join(p['gate_failures'])})" for p in plan if p["downgraded"]]
    notes += [f"{p['id']}: v{p['version']} updated, claims/checks/status only" for p in plan if p["evidence_only"]]

    with conn.transaction():
        run_id = unique_run_id(conn, data["run"]["run_id"])
        conn.execute(
            "insert into import_runs (run_id, file_name, schema_version, model, prompt_version, "
            "rows_inserted, rows_updated, rows_skipped, notes) values (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (run_id, file_name, data["schema_version"], data["run"]["model"], data["run"]["prompt_version"],
             counts["insert"], counts["update"], counts["skip"], Jsonb(notes)),
        )
        conn.execute("insert into diseases (id, name) values (%s,%s) "
                     "on conflict (id) do update set name = excluded.name",
                     (data["disease"]["id"], data["disease"]["name"]))
        for s in data["sources"]:
            conn.execute(
                "insert into sources (id, title, type, provided_by, file_hash) values (%s,%s,%s,%s,%s) "
                "on conflict (id) do update set title = excluded.title, type = excluded.type, "
                "provided_by = excluded.provided_by, file_hash = excluded.file_hash",
                (s["id"], s["title"], s["type"], s["provided_by"], s["file_hash"]))
        # Names and order are upserted; status is left alone so published topics stay published.
        for t in data["topics"]:
            conn.execute(
                "insert into topics (id, disease_id, name, sort_order, icon) values (%s,%s,%s,%s,%s) "
                "on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order, "
                "icon = excluded.icon, updated_at = now()",
                (t["id"], data["disease"]["id"], t["name"], t["order"], t.get("icon")))
            for s in t["subtopics"]:
                conn.execute(
                    "insert into subtopics (id, topic_id, name, sort_order) values (%s,%s,%s,%s) "
                    "on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order, "
                    "updated_at = now()",
                    (s["id"], t["id"], s["name"], s["order"]))
        for m in data["media"]:
            conn.execute(
                "insert into media (id, storage_path, alt_text, credit, source_id) values (%s,%s,%s,%s,%s) "
                "on conflict (id) do update set storage_path = excluded.storage_path, "
                "alt_text = excluded.alt_text, credit = excluded.credit, source_id = excluded.source_id",
                (m["id"], storage_path(m), m["alt_text"], m["credit"], m["source_id"]))

        quizzes: dict[str, list[dict]] = {}
        for q in data["quizzes"]:
            quizzes.setdefault(q["lesson_id"], []).append(q)

        for lesson in data["lessons"]:
            p = plan_by_id[lesson["id"]]
            # Placement is not clinical content: keep it current on every stored version.
            conn.execute(
                "update lessons set subtopic_id = %s, sort_order = %s "
                "where id = %s and (subtopic_id, sort_order) is distinct from (%s, %s)",
                (lesson["subtopic_id"], p["sort_order"], lesson["id"], lesson["subtopic_id"], p["sort_order"]))
            if p["action"] == "skip":
                continue
            row = (lesson["subtopic_id"], p["sort_order"], lesson["title"], lesson["est_minutes"],
                   Jsonb(lesson["pages"]), Jsonb(lesson["key_takeaways"]), lesson["generated_by"],
                   Jsonb(lesson["checks"]), p["content_hash"], p["evidence_hash"], p["status"], run_id)
            if p["action"] == "insert":
                conn.execute(
                    "insert into lessons (subtopic_id, sort_order, title, est_minutes, pages, key_takeaways, "
                    "generated_by, checks, content_hash, evidence_hash, status, run_id, id, version) "
                    "values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    row + (lesson["id"], p["version"]))
            else:
                conn.execute(
                    "update lessons set subtopic_id=%s, sort_order=%s, title=%s, est_minutes=%s, pages=%s, "
                    "key_takeaways=%s, generated_by=%s, checks=%s, content_hash=%s, evidence_hash=%s, "
                    "status=%s, run_id=%s, updated_at=now() where id=%s and version=%s",
                    row + (lesson["id"], p["version"]))
                for table in ("lesson_claims", "lesson_media", "quiz_items"):
                    conn.execute(f"delete from {table} where lesson_id=%s and lesson_version=%s",
                                 (lesson["id"], p["version"]))
            for c in lesson["claims"]:
                conn.execute(
                    "insert into lesson_claims (id, lesson_id, lesson_version, text, page, source_id, "
                    "source_page, source_quote, support, quote_match) values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    (c["id"], lesson["id"], p["version"], c["text"], c["page"], c["source_id"],
                     c["source_page"], c["source_quote"], c["support"], c["quote_match"]))
            for img in lesson.get("images", []):
                conn.execute("insert into lesson_media (lesson_id, lesson_version, media_id, page) "
                             "values (%s,%s,%s,%s)", (lesson["id"], p["version"], img["media_id"], img["page"]))
            for q in quizzes.get(lesson["id"], []):
                # A quiz item can only be 'checked' while its lesson is.
                q_status = q["status"] if p["status"] == "checked" else "draft"
                conn.execute(
                    "insert into quiz_items (id, lesson_id, lesson_version, question, options, answer, "
                    "feedback, source_id, source_page, source_quote, status) "
                    "values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    (q["id"], lesson["id"], p["version"], q["question"], Jsonb(q["options"]), q["answer"],
                     q["feedback"], q["source_id"], q["source_page"], q["source_quote"], q_status))
    return {"run_id": run_id, "notes": notes}


# --- §5.5 images ------------------------------------------------------------

def upload_media(client, data: dict, media_dir: Path) -> list[str]:
    """Upload every image to the Storage bucket, upsert so re-runs are safe. Returns the paths."""
    paths = []
    for m in data["media"]:
        path = storage_path(m)
        content_type = mimetypes.guess_type(m["file"])[0] or "application/octet-stream"
        client.storage.from_(BUCKET).upload(
            path, (media_dir / m["file"]).read_bytes(), {"content-type": content_type, "upsert": "true"})
        paths.append(path)
    return paths


# --- CLI --------------------------------------------------------------------

REQUIRED_SETTINGS = ("SUPABASE_DB_URL", "SUPABASE_URL", "SUPABASE_SERVICE_KEY")


def load_settings(start: Path) -> dict:
    """Environment variables win over the nearest .env file above the script."""
    from dotenv import dotenv_values

    env_file = find_upwards(start, ".env")
    values = dict(dotenv_values(env_file)) if env_file else {}
    values.update({k: os.environ[k] for k in os.environ if k.startswith("SUPABASE_")})
    return values


def _fail(message: str, details: list[str] = ()) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    for d in details:
        print(f"  - {d}", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("export", type=Path, help="export JSON")
    ap.add_argument("--dry-run", action="store_true", help="check and report only; upload and write nothing")
    ap.add_argument("--from-db", action="store_true",
                    help="dry run only: compare with the versions stored in the database (read-only)")
    ap.add_argument("--schema", type=Path, help="content.schema.json (default: searched upwards)")
    ap.add_argument("--media-dir", type=Path, help="folder holding the image files (default: next to the JSON)")
    ap.add_argument("--existing", type=Path,
                    help="dry run only: JSON {lesson_id: {version, status, content_hash, evidence_hash}} "
                         "of the latest stored versions (default: empty database)")
    args = ap.parse_args(argv)

    settings = load_settings(here) if (not args.dry_run or args.from_db) else {}
    needed = REQUIRED_SETTINGS if not args.dry_run else ("SUPABASE_DB_URL",)
    if (not args.dry_run or args.from_db) and (missing := [k for k in needed if not settings.get(k)]):
        _fail("missing settings (environment or .env): " + ", ".join(missing))
        return 2
    if args.from_db and args.existing:
        _fail("use either --from-db or --existing, not both")
        return 2

    try:
        schema_path = args.schema or find_upwards(here, "schema/content.schema.json")
        if not schema_path:
            raise ImportRejected(["schema/content.schema.json not found; pass --schema"])
        schema = json.loads(Path(schema_path).read_text(encoding="utf-8"))
        media_dir = args.media_dir or args.export.parent
        data = load_and_validate(args.export, schema, media_dir)
        existing = {}
        if args.existing:
            try:
                existing = json.loads(args.existing.read_text(encoding="utf-8"))
            except (OSError, ValueError) as e:
                raise ImportRejected([f"cannot read {args.existing}: {e}"]) from e
    except ImportRejected as e:
        _fail(f"file rejected ({len(e.errors)} problems); nothing written", e.errors)
        return 1

    if args.dry_run and not args.from_db:
        plan = plan_lessons(data, existing)
        print(format_report(build_report(data, plan), plan))
        print("dry run: nothing uploaded or written")
        return 0

    import psycopg

    try:
        # Read-only first: the plan depends on what is stored.
        with psycopg.connect(settings["SUPABASE_DB_URL"], connect_timeout=15) as conn:
            existing = fetch_existing(conn, [l["id"] for l in data["lessons"]])
            plan = plan_lessons(data, existing)
            report_text = format_report(build_report(data, plan), plan)
            if args.dry_run:
                print(report_text)
                print("dry run: nothing uploaded or written")
                return 0
            from supabase import create_client

            upload_media(create_client(settings["SUPABASE_URL"], settings["SUPABASE_SERVICE_KEY"]), data, media_dir)
            result = write_import(conn, data, plan, args.export.name)
        print(report_text)
        print(f"committed as import run {result['run_id']}; {len(data['media'])} images uploaded")
        return 0
    except Exception as e:  # nothing is partially written: the transaction rolls back
        _fail(f"import failed, database unchanged: {type(e).__name__}: {str(e).splitlines()[0][:300] if str(e) else ''}")
        return 1


if __name__ == "__main__":
    sys.exit(main())

"""B3: publish reviewed lessons, or roll a lesson back (week 9 plan §7).

    python backend/scripts/publish.py --lesson psa-dx-01 [--version 2] [--dry-run]
    python backend/scripts/publish.py --all-reviewed [--dry-run]
    python backend/scripts/publish.py --rollback psa-dx-01 [--dry-run]

Publishing is a separate, deliberate step: a team member runs it after the review.
All changes in one run happen in one transaction (all or nothing). --dry-run runs the
real SQL functions and then rolls back, so the report is exactly what would happen.
Every change is appended to backend/logs/publish_log.jsonl.

Setting (environment or .env): SUPABASE_DB_URL.
"""
from __future__ import annotations

import argparse
import getpass
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg

from import_content import load_settings

DEFAULT_LOG = Path(__file__).resolve().parents[1] / "logs" / "publish_log.jsonl"


class PublishError(Exception):
    pass


def lesson_versions(conn, lesson_id: str) -> list[tuple[int, str, str]]:
    return conn.execute("select version, status::text, title from lessons where id = %s order by version",
                        (lesson_id,)).fetchall()


def published_version(conn, lesson_id: str):
    row = conn.execute("select version from lessons where id = %s and status = 'published'", (lesson_id,)).fetchone()
    return row[0] if row else None


def resolve_targets(conn, lesson_id: str | None, version: int | None) -> list[tuple[str, int]]:
    """(lesson id, version) pairs to publish. Raises PublishError with the reason."""
    if lesson_id:
        versions = lesson_versions(conn, lesson_id)
        if not versions:
            raise PublishError(f"{lesson_id}: no such lesson")
        if version is not None:
            match = [v for v in versions if v[0] == version]
            if not match:
                raise PublishError(f"{lesson_id}: no version {version} (have {[v[0] for v in versions]})")
            if match[0][1] != "reviewed":
                raise PublishError(f"{lesson_id} v{version} is {match[0][1]}; only reviewed lessons can be published")
            return [(lesson_id, version)]
        reviewed = [v[0] for v in versions if v[1] == "reviewed"]
        if not reviewed:
            states = ", ".join(f"v{v[0]} {v[1]}" for v in versions)
            raise PublishError(f"{lesson_id}: no reviewed version to publish ({states})")
        return [(lesson_id, max(reviewed))]
    rows = conn.execute(
        "select id, max(version) from lessons where status = 'reviewed' group by id order by id").fetchall()
    if not rows:
        raise PublishError("no reviewed lessons to publish")
    return [(r[0], r[1]) for r in rows]


def publish_lessons(conn, targets: list[tuple[str, int]]) -> list[dict]:
    """Publish each target with publish_lesson(). Caller owns the outer transaction."""
    results = []
    with conn.transaction():
        for lesson_id, version in targets:
            replaced = published_version(conn, lesson_id)
            title = conn.execute("select title from lessons where id=%s and version=%s",
                                 (lesson_id, version)).fetchone()[0]
            conn.execute("select publish_lesson(%s, %s)", (lesson_id, version))
            quizzes = conn.execute("select count(*) from quiz_items where lesson_id=%s and lesson_version=%s "
                                   "and status = 'published'", (lesson_id, version)).fetchone()[0]
            results.append({"action": "publish", "lesson_id": lesson_id, "version": version, "title": title,
                            "replaced_version": replaced, "quiz_items_published": quizzes})
    return results


def rollback_lesson(conn, lesson_id: str) -> dict:
    with conn.transaction():
        if not lesson_versions(conn, lesson_id):
            raise PublishError(f"{lesson_id}: no such lesson")
        replaced = published_version(conn, lesson_id)
        try:
            with conn.transaction():
                restored = conn.execute("select rollback_lesson(%s)", (lesson_id,)).fetchone()[0]
        except psycopg.errors.RaiseException as e:
            raise PublishError(str(e).splitlines()[0]) from e
    return {"action": "rollback", "lesson_id": lesson_id, "version": restored, "replaced_version": replaced}


def format_result(r: dict) -> str:
    if r["action"] == "rollback":
        was = f"v{r['replaced_version']} archived, " if r["replaced_version"] else ""
        return f"{r['lesson_id']}: rolled back, {was}v{r['version']} published again"
    replaced = f", v{r['replaced_version']} archived" if r["replaced_version"] else ""
    return (f"{r['lesson_id']} v{r['version']}: reviewed -> published{replaced}; "
            f"{r['quiz_items_published']} quiz items published ({r['title']})")


def write_log(path: Path, results: list[dict], actor: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with path.open("a", encoding="utf-8") as f:
        for r in results:
            f.write(json.dumps({"at": now, "by": actor, **r}) + "\n")


def run(conn, args, log_path: Path = DEFAULT_LOG) -> list[dict]:
    """Do the requested work in one transaction; roll it back for --dry-run."""
    with conn.transaction(force_rollback=args.dry_run):
        if args.rollback:
            results = [rollback_lesson(conn, args.rollback)]
        else:
            results = publish_lessons(conn, resolve_targets(conn, args.lesson, args.version))
    if not args.dry_run:  # logged after the commit, so the log never records a change that did not happen
        write_log(log_path, results, getpass.getuser())
    return results


def open_connection(url: str):
    return psycopg.connect(url, connect_timeout=15)


def main(argv: list[str] | None = None, log_path: Path = DEFAULT_LOG) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    what = ap.add_mutually_exclusive_group(required=True)
    what.add_argument("--lesson", help="lesson id to publish (latest reviewed version unless --version)")
    what.add_argument("--all-reviewed", action="store_true", help="publish every reviewed lesson")
    what.add_argument("--rollback", metavar="LESSON", help="re-publish the latest archived version")
    ap.add_argument("--version", type=int, help="with --lesson: the version to publish")
    ap.add_argument("--dry-run", action="store_true", help="show what would change; change nothing")
    args = ap.parse_args(argv)
    if args.version is not None and not args.lesson:
        ap.error("--version needs --lesson")

    url = load_settings(Path(__file__).resolve().parent).get("SUPABASE_DB_URL")
    if not url:
        print("ERROR: missing settings (environment or .env): SUPABASE_DB_URL", file=sys.stderr)
        return 2
    try:
        with open_connection(url) as conn:
            results = run(conn, args, log_path)
    except PublishError as e:
        print(f"ERROR: {e}; nothing changed", file=sys.stderr)
        return 1
    except psycopg.Error as e:
        print(f"ERROR: database error, nothing changed: {type(e).__name__}: {str(e).splitlines()[0][:300]}",
              file=sys.stderr)
        return 1

    for r in results:
        print(format_result(r))
    print("dry run: nothing changed" if args.dry_run else f"done: {len(results)} change(s) logged to {log_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

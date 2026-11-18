"""B2: build the Rubric B review sheet, and import Dr. Murphy's scores (week 9 plan §6).

    python backend/scripts/review_import.py --make-sheet reviews/sheet.csv
    python backend/scripts/review_import.py reviews/rubric_b_2026-10-30.csv --reviewer "Dr. Murphy" [--dry-run]

The sheet contains `checked` lessons only, so the reviewer never sees lessons that failed
the automatic checks. When importing, every scored row calls apply_review(); the pass rule
is computed in SQL and the sheet's `decision` column is ignored. A malformed file is
rejected as a whole; a row that cannot be reviewed (lesson not found, not `checked`) is
reported and the other rows still go through. --dry-run runs the real SQL and rolls back.

Setting (environment or .env): SUPABASE_DB_URL.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

import psycopg

from import_content import load_settings

SCORES = ("accuracy", "completeness", "readability", "safety", "terminology")
SHEET_COLUMNS = ["lesson_id", "version", "title", "page_text", "images", "video_script", "sources", "fk_grade", "flags",
                 *SCORES, "decision", "comment"]
DEFAULT_VIDEO_SCRIPTS = Path(__file__).resolve().parents[2] / "data" / "psa" / "assisted-input" / "all-topics.json"
REQUIRED_COLUMNS = ["lesson_id", "version", *SCORES, "comment"]


class SheetRejected(Exception):
    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


# --- the review sheet -------------------------------------------------------

def format_sources(provenance: list[dict], titles: dict[str, str]) -> str:
    """Readable source correspondence for one lesson: what each source gave, where, and its limits."""
    blocks, links = [], []
    for record in provenance or []:
        for u in record.get("source_usage", []):
            pages = ", ".join(str(p) for p in u["pages"])
            name = titles.get(u["source_id"], u["source_id"])
            blocks.append(f"{len(blocks) + 1}. {name} (lesson p. {pages})\n   Where: {u['locator']}\n"
                          f"   Contributed: {u['contribution']}\n   Limits: {u['limits']}")
        links += [f"- {r['title']} - {r['url']}" for r in record.get("references", [])]
    sections = ([["Sources used", *blocks]] if blocks else []) + ([["References", *links]] if links else [])
    return "\n\n".join("\n".join(s) for s in sections)


def public_url(base: str, path: str) -> str:
    """Public Storage URL for a path in the `media` bucket (just the path when no project URL is known)."""
    return f"{base.rstrip('/')}/storage/v1/object/public/media/{path}" if base else path


def format_images(images: list[dict], base: str) -> str:
    """One numbered block per image: page, what it shows, credit, and a link the reviewer can open."""
    return "\n\n".join(
        f"{n}. Page {i['page']}: {i['alt_text']}\n   Credit: {i['credit']}\n   {public_url(base, i['path'])}"
        for n, i in enumerate(images, start=1))


def load_video_scripts(path: Path) -> dict[str, dict]:
    """lesson id -> its `video` object, read from the Data Lead's all-topics.json (not stored in the database)."""
    found: dict[str, dict] = {}

    def walk(node):
        if isinstance(node, dict):
            if "id" in node and isinstance(node.get("video"), dict):
                found[node["id"]] = node["video"]
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    try:
        walk(json.loads(path.read_text(encoding="utf-8")))
    except (OSError, ValueError) as e:
        raise SheetRejected([f"cannot read video scripts from {path}: {e}"]) from e
    return found


def format_video_script(video: dict | None) -> str:
    """The narration a reviewer would hear, scene by scene, each line tagged with the source it came from."""
    scenes = (video or {}).get("scenes", [])
    return "\n\n".join(
        "\n".join([f"Scene {n}: {s['name']}", *(f"- {l['text']} [{l['source']}]" for l in s["lines"])])
        for n, s in enumerate(scenes, start=1))


def make_sheet_rows(conn, base_url: str = "", video_scripts: dict | None = None) -> list[dict]:
    """One row per `checked` lesson version, with the evidence the reviewer needs.

    base_url: the Supabase project URL, used to build image links.
    video_scripts: lesson id -> video object (see load_video_scripts); fills the video_script column.
    """
    lessons = conn.execute(
        "select id, version, title, pages, checks, provenance from lessons "
        "where status = 'checked' order by id, version"
    ).fetchall()
    titles = dict(conn.execute("select id, title from sources").fetchall())
    images: dict[tuple, list[dict]] = {}
    for lid, ver, page, alt, credit, path in conn.execute(
            "select lm.lesson_id, lm.lesson_version, lm.page, m.alt_text, m.credit, m.storage_path "
            "from lesson_media lm join media m on m.id = lm.media_id order by lm.page, m.id").fetchall():
        images.setdefault((lid, ver), []).append({"page": page, "alt_text": alt, "credit": credit, "path": path})

    return [{
        "lesson_id": lesson_id, "version": version, "title": title,
        "page_text": "\n\n".join(f"[page {p['order']}] {p['body']}" for p in pages),
        "images": format_images(images.get((lesson_id, version), []), base_url),
        "video_script": format_video_script((video_scripts or {}).get(lesson_id)),
        "sources": format_sources(provenance, titles),
        "fk_grade": checks.get("fk_grade", ""),
        "flags": "; ".join(checks.get("safety_flags") or []),
        **{s: "" for s in SCORES}, "decision": "", "comment": "",
    } for lesson_id, version, title, pages, checks, provenance in lessons]



def write_sheet(path: Path, rows: list[dict]) -> None:
    if path.exists():
        raise SheetRejected([f"{path} already exists; choose another name or delete it"])
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:  # BOM so Excel reads UTF-8
        w = csv.DictWriter(f, fieldnames=SHEET_COLUMNS)
        w.writeheader()
        w.writerows(rows)


# --- reading scores ---------------------------------------------------------

def read_scores(path: Path) -> tuple[list[dict], list[str]]:
    """(scored rows, ids of rows left blank). Raises SheetRejected on any malformed row."""
    try:
        with path.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            header = reader.fieldnames or []
            rows = list(reader)
    except (OSError, UnicodeDecodeError, csv.Error) as e:
        raise SheetRejected([f"cannot read {path}: {e}"]) from e
    missing = [c for c in REQUIRED_COLUMNS if c not in header]
    if missing:
        raise SheetRejected([f"missing column(s): {', '.join(missing)}"])

    errors, scored, blank, seen = [], [], [], set()
    for n, row in enumerate(rows, start=2):  # line 1 is the header
        where = f"line {n}"
        lesson_id = (row["lesson_id"] or "").strip()
        if not lesson_id:
            if any((v or "").strip() for v in row.values()):
                errors.append(f"{where}: lesson_id is empty")
            continue
        values = {s: (row[s] or "").strip() for s in SCORES}
        if not any(values.values()):
            blank.append(lesson_id)
            continue
        empty = [s for s, v in values.items() if not v]
        if empty:
            errors.append(f"{where} ({lesson_id}): missing score(s): {', '.join(empty)}")
            continue
        try:
            version = int((row["version"] or "").strip())
        except ValueError:
            errors.append(f"{where} ({lesson_id}): version must be a whole number")
            continue
        bad = [s for s, v in values.items() if not (v.isdigit() and 1 <= int(v) <= 5)]
        if bad:
            errors.append(f"{where} ({lesson_id}): scores must be whole numbers 1-5: {', '.join(bad)}")
            continue
        if (lesson_id, version) in seen:
            errors.append(f"{where}: {lesson_id} v{version} appears twice")
            continue
        seen.add((lesson_id, version))
        scored.append({"lesson_id": lesson_id, "version": version, **{s: int(v) for s, v in values.items()},
                       "comment": (row["comment"] or "").strip() or None})
    if errors:
        raise SheetRejected(errors)
    return scored, blank


# --- applying them ----------------------------------------------------------

def apply_reviews(conn, rows: list[dict], reviewer: str) -> list[dict]:
    """Call apply_review() per row. A row that cannot be reviewed becomes an error result."""
    results = []
    for r in rows:
        try:
            with conn.transaction():  # savepoint: one bad row does not undo the others
                outcome = conn.execute(
                    "select apply_review(%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    (r["lesson_id"], r["version"], reviewer, r["accuracy"], r["completeness"], r["readability"],
                     r["safety"], r["terminology"], r["comment"])).fetchone()[0]
            results.append({"lesson_id": r["lesson_id"], "version": r["version"], "outcome": outcome})
        except psycopg.errors.RaiseException as e:
            results.append({"lesson_id": r["lesson_id"], "version": r["version"], "outcome": "error",
                            "error": str(e).splitlines()[0]})
    return results


def format_result(r: dict) -> str:
    head = f"{r['lesson_id']} v{r['version']}: "
    if r["outcome"] == "reviewed":
        return head + "reviewed (passed; ready to publish)"
    if r["outcome"] == "revise":
        return head + "revise (stays checked; send the comment back to the Data Lead)"
    return head + f"ERROR {r['error']}"


def open_connection(url: str):
    return psycopg.connect(url, connect_timeout=15)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("scores", nargs="?", type=Path, help="CSV with the reviewer's scores")
    ap.add_argument("--reviewer", help="name recorded with every review (required when importing scores)")
    ap.add_argument("--make-sheet", type=Path, metavar="OUT.csv", help="write the review sheet and exit")
    ap.add_argument("--video-scripts", type=Path, default=DEFAULT_VIDEO_SCRIPTS, metavar="ALL_TOPICS.json",
                    help="all-topics.json to read each lesson's video narration from (default: the repo's copy, if present)")
    ap.add_argument("--dry-run", action="store_true", help="run the real SQL, then roll back")
    args = ap.parse_args(argv)
    if bool(args.make_sheet) == bool(args.scores):
        ap.error("give either a scores CSV or --make-sheet OUT.csv")
    if args.scores and not (args.reviewer or "").strip():
        ap.error("--reviewer is required when importing scores")

    settings = load_settings(Path(__file__).resolve().parent)
    url = settings.get("SUPABASE_DB_URL")
    if not url:
        print("ERROR: missing settings (environment or .env): SUPABASE_DB_URL", file=sys.stderr)
        return 2
    try:
        if args.make_sheet:
            with open_connection(url) as conn:
                scripts = load_video_scripts(args.video_scripts) if args.video_scripts and args.video_scripts.exists() else {}
                rows = make_sheet_rows(conn, settings.get("SUPABASE_URL", ""), scripts)
            if not rows:
                print("No checked lessons to review; no sheet written.")
                return 0
            write_sheet(args.make_sheet, rows)
            print(f"wrote {args.make_sheet} with {len(rows)} lesson(s): " + ", ".join(r["lesson_id"] for r in rows))
            return 0

        scored, blank = read_scores(args.scores)
        with open_connection(url) as conn:
            with conn.transaction(force_rollback=args.dry_run):
                results = apply_reviews(conn, scored, args.reviewer.strip())
    except SheetRejected as e:
        print(f"ERROR: file rejected ({len(e.errors)} problems); nothing changed", file=sys.stderr)
        for err in e.errors:
            print(f"  - {err}", file=sys.stderr)
        return 1
    except psycopg.Error as e:
        print(f"ERROR: database error, nothing changed: {type(e).__name__}: {str(e).splitlines()[0][:300]}",
              file=sys.stderr)
        return 1

    for r in results:
        print(format_result(r))
    for lesson_id in blank:
        print(f"{lesson_id}: not scored yet, skipped")
    errors = sum(r["outcome"] == "error" for r in results)
    print(f"{'dry run (nothing changed): ' if args.dry_run else ''}"
          f"{sum(r['outcome'] == 'reviewed' for r in results)} reviewed, "
          f"{sum(r['outcome'] == 'revise' for r in results)} revise, {errors} error(s), {len(blank)} not scored")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

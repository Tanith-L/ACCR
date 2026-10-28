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
import sys
from pathlib import Path

import psycopg

from import_content import load_settings

SCORES = ("accuracy", "completeness", "readability", "safety", "terminology")
SHEET_COLUMNS = ["lesson_id", "version", "title", "page_text", "claims_with_quotes", "fk_grade", "flags",
                 *SCORES, "decision", "comment"]
REQUIRED_COLUMNS = ["lesson_id", "version", *SCORES, "comment"]


class SheetRejected(Exception):
    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


# --- the review sheet -------------------------------------------------------

def make_sheet_rows(conn) -> list[dict]:
    """One row per `checked` lesson version, with the evidence the reviewer needs."""
    lessons = conn.execute(
        "select id, version, title, pages, checks from lessons where status = 'checked' order by id, version"
    ).fetchall()
    rows = []
    for lesson_id, version, title, pages, checks in lessons:
        claims = conn.execute(
            "select c.id, c.text, c.page, s.title, c.source_page, c.source_quote from lesson_claims c "
            "join sources s on s.id = c.source_id where c.lesson_id = %s and c.lesson_version = %s order by c.id",
            (lesson_id, version)).fetchall()
        rows.append({
            "lesson_id": lesson_id, "version": version, "title": title,
            "page_text": "\n\n".join(f"[page {p['order']}] {p['body']}" for p in pages),
            "claims_with_quotes": "\n".join(
                f"{cid} (p.{page}): {text}  <- {src} p.{sp}: \"{quote}\"" for cid, text, page, src, sp, quote in claims),
            "fk_grade": checks.get("fk_grade", ""),
            "flags": "; ".join(checks.get("safety_flags") or []),
            **{s: "" for s in SCORES}, "decision": "", "comment": "",
        })
    return rows


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
    ap.add_argument("--dry-run", action="store_true", help="run the real SQL, then roll back")
    args = ap.parse_args(argv)
    if bool(args.make_sheet) == bool(args.scores):
        ap.error("give either a scores CSV or --make-sheet OUT.csv")
    if args.scores and not (args.reviewer or "").strip():
        ap.error("--reviewer is required when importing scores")

    url = load_settings(Path(__file__).resolve().parent).get("SUPABASE_DB_URL")
    if not url:
        print("ERROR: missing settings (environment or .env): SUPABASE_DB_URL", file=sys.stderr)
        return 2
    try:
        if args.make_sheet:
            with open_connection(url) as conn:
                rows = make_sheet_rows(conn)
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

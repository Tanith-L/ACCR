"""Turn the Rubric B review sheet (CSV) into one self-contained HTML page a reviewer can use.

    python backend/scripts/make_review_page.py reviews/rubric_b_review_sheet_2026-11-18.csv \
        reviews/rubric_b_review_2026-11-18.html

The page shows each lesson's text, images, video script and sources, takes the five Rubric B
scores and a comment, saves progress in the browser, and downloads a scores CSV with the same
columns review_import.py reads (lesson_id, version, the five scores, comment). The page needs no
server. Images load from their public links, so they need an internet connection.

The sheet's text columns are parsed back into structure, and each one is re-formatted with
review_import's own formatters and compared with the original, so a change to the sheet format
fails here instead of producing a page with missing sections.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

import review_import as rev

TEMPLATE = Path(__file__).with_name("review_page_template.html")


class PageError(Exception):
    pass


def parse_pages(text: str) -> list[dict]:
    parts = re.split(r"(?m)^\[page (\d+)\] ", text)
    return [{"n": int(parts[i]), "body": parts[i + 1].rstrip()} for i in range(1, len(parts) - 1, 2)]


def parse_images(text: str) -> list[dict]:
    pattern = re.compile(r"(?ms)^(\d+)\. Page (\d+): (.*?)\n   Credit: (.*?)\n   (\S+)\s*(?=^\d+\. Page |\Z)")
    return [{"page": int(m[2]), "alt": m[3], "credit": m[4], "url": m[5]} for m in pattern.finditer(text)]


def parse_video(text: str) -> list[dict]:
    scenes = []
    for block in filter(None, re.split(r"\n\n(?=Scene \d+: )", text)):
        head, *lines = block.split("\n")
        name = re.fullmatch(r"Scene \d+: (.*)", head)
        parsed = [re.fullmatch(r"- (.*) \[([^\]]*)\]", line) for line in lines]
        if not name or not all(parsed):
            raise PageError(f"cannot read video script block: {block[:60]!r}")
        scenes.append({"name": name[1], "lines": [{"text": m[1], "source": m[2]} for m in parsed]})
    return scenes


def parse_sources(text: str) -> tuple[list[dict], list[dict]]:
    used, _, refs = text.partition("\n\nReferences\n") if "\n\nReferences\n" in text else (text, "", "")
    if used.startswith("References\n"):
        used, refs = "", used[len("References\n"):]
    pattern = re.compile(r"(?ms)^\d+\. (.*?) \(lesson p\. ([^)]*)\)\n   Where: (.*?)\n   Contributed: (.*?)\n   Limits: (.*?)(?=\n\d+\. .*? \(lesson p\. |\Z)")
    sources = [{"title": m[1], "pages": m[2], "where": m[3], "contributed": m[4], "limits": m[5]} for m in pattern.finditer(used)]
    references = []
    for line in filter(None, refs.split("\n")):
        title, sep, url = line[2:].rpartition(" - ")
        references.append({"title": title, "url": url} if sep else {"title": line[2:], "url": ""})
    return sources, references


def to_lesson(row: dict) -> dict:
    lesson = {
        "id": row["lesson_id"], "version": int(row["version"]), "title": row["title"],
        "fk_grade": float(row["fk_grade"]) if row["fk_grade"] else None,
        "flags": [f for f in row["flags"].split("; ") if f],
        "pages": parse_pages(row["page_text"]), "images": parse_images(row["images"]),
        "video": parse_video(row["video_script"]),
    }
    lesson["sources"], lesson["references"] = parse_sources(row["sources"])

    # Round trip: the structure must reproduce the sheet's text exactly, or something was dropped.
    where = row["lesson_id"]
    pages_text = "\n\n".join(f"[page {p['order']}] {p['body']}" for p in
                             ({"order": p["n"], "body": p["body"]} for p in lesson["pages"]))
    if pages_text != row["page_text"].rstrip():
        raise PageError(f"{where}: page_text did not parse cleanly")
    images = [{"page": i["page"], "alt_text": i["alt"], "credit": i["credit"], "path": i["url"]} for i in lesson["images"]]
    if rev.format_images(images, "").strip() != row["images"].strip():
        raise PageError(f"{where}: images did not parse cleanly")
    if rev.format_video_script({"scenes": [{"name": s["name"], "lines": s["lines"]} for s in lesson["video"]]}) != row["video_script"]:
        raise PageError(f"{where}: video_script did not parse cleanly")
    if any(re.search(r"(?m)^\d+\. .* \(lesson p\. ", s[k]) for s in lesson["sources"] for k in ("where", "contributed", "limits")):
        raise PageError(f"{where}: two sources were read as one")
    provenance = [{"source_usage": [{"source_id": s["title"], "pages": [s["pages"]], "locator": s["where"],
                                     "contribution": s["contributed"], "limits": s["limits"]} for s in lesson["sources"]],
                   "references": [{"title": r["title"], "url": r["url"]} for r in lesson["references"]]}]
    if rev.format_sources(provenance, {}) != row["sources"]:
        raise PageError(f"{where}: sources did not parse cleanly")
    return lesson


def read_sheet(path: Path) -> list[dict]:
    try:
        with path.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            missing = [c for c in rev.SHEET_COLUMNS if c not in (reader.fieldnames or [])]
            rows = list(reader)
    except (OSError, UnicodeDecodeError, csv.Error) as e:
        raise PageError(f"cannot read {path}: {e}") from e
    if missing:
        raise PageError(f"sheet is missing column(s): {', '.join(missing)}")
    if not rows:
        raise PageError("sheet has no lessons")
    return rows


def build_page(rows: list[dict], generated: str | None = None) -> str:
    lessons = [to_lesson(r) for r in rows]
    payload = {"generated": generated or date.today().isoformat(), "lessons": lessons}
    payload["build"] = hashlib.sha1(json.dumps(lessons, sort_keys=True).encode("utf-8")).hexdigest()[:10]
    data = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")
    return TEMPLATE.read_text(encoding="utf-8").replace("__DATA__", data)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("sheet", type=Path, help="review sheet CSV from review_import.py --make-sheet")
    ap.add_argument("out", type=Path, help="HTML file to write")
    ap.add_argument("--overwrite", action="store_true", help="replace the output file if it exists")
    args = ap.parse_args(argv)
    try:
        if args.out.exists() and not args.overwrite:
            raise PageError(f"{args.out} already exists; choose another name or pass --overwrite")
        rows = read_sheet(args.sheet)
        page = build_page(rows)
    except PageError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(page, encoding="utf-8")
    print(f"wrote {args.out} ({args.out.stat().st_size // 1024} KB, {len(rows)} lessons)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

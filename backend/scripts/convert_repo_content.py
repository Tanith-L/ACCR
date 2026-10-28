"""Convert the Data Lead's first content set (topics.yaml, lessons/*.md,
quizzes.yaml, media/media.yaml at the repo root) into a schema-valid export
JSON (schema/content.schema.json), so the import, database and app can be
tested on real content. Everything stays `draft`; the input files are only read.

    python backend/scripts/convert_repo_content.py [--repo-root DIR] [--out FILE] [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

PROVIDED_BY = "Dr. Frederick T. Murphy"
# The repo content does not carry the source files, so their hash is unknown.
UNKNOWN_HASH = "0" * 64
DEFAULT_SOURCE_TYPE = "pdf"
# Quizzes in the first content set have no verbatim source quote.
NO_QUOTE = "(source quote not provided in the repo content)"
PAGE_SPLIT = re.compile(r"^[ \t]*---page---[ \t]*$", re.MULTILINE)
FRONT_MATTER = re.compile(r"\A---[ \t]*\r?\n(.*?)\r?\n---[ \t]*\r?\n?(.*)\Z", re.DOTALL)
CITATION = re.compile(r"^(?P<title>.+?)\s+pp?\.\s*(?P<page>\d+)")

# Same document cited under different names in the first content set.
TITLE_ALIASES = {
    "GRAPPA domains in PSA which guide treatment decisions": "GRAPPA domains in PSA poster",
    "poster of the comorbidities seen in PSA (top 10)": "poster of the comorbidities seen in PSA",
    "clinical manifestations of PSA written at an 8th grade level": "clinical manifestations of PSA poster",
}


class ConversionError(Exception):
    pass


# --- readability (the only `checks` numbers the repo content can have) ------

def _syllables(word: str) -> int:
    word = word.lower()
    count = len(re.findall(r"[aeiouy]+", word))
    if word.endswith("e") and not word.endswith(("le", "ee")) and count > 1:
        count -= 1
    return max(count, 1)


def readability(text: str) -> dict:
    """Flesch-Kincaid grade and SMOG grade, rounded to 1 decimal."""
    text = re.sub(r"[*_#>`]|^\s*[-+]\s+", "", text, flags=re.MULTILINE)
    sentences = max(len([s for s in re.split(r"[.!?]+(?:\s+|$)", text) if s.strip()]), 1)
    words = re.findall(r"[A-Za-z][A-Za-z'’-]*", text)
    if not words:
        return {"fk_grade": 0.0, "smog": 0.0}
    syll = [_syllables(w) for w in words]
    fk = 0.39 * len(words) / sentences + 11.8 * sum(syll) / len(words) - 15.59
    poly = sum(1 for s in syll if s >= 3)
    smog = 1.043 * math.sqrt(poly * 30 / sentences) + 3.1291
    return {"fk_grade": round(max(fk, 0.0), 1), "smog": round(smog, 1)}


# --- parsing ----------------------------------------------------------------

def slug(text: str) -> str:
    text = text.replace("’", "").replace("'", "")
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def parse_citations(text: str) -> list[tuple[str, int]]:
    """'A p.1; B pp.9, 12-13' -> [('A', 1), ('B', 9)] (title, first page)."""
    out = []
    for part in str(text).split(";"):
        m = CITATION.match(part.strip())
        if not m:
            raise ConversionError(f"cannot parse source citation: {part.strip()!r}")
        title = m["title"].strip()
        out.append((TITLE_ALIASES.get(title, title), int(m["page"])))
    return out


class Sources:
    def __init__(self) -> None:
        self._by_id: dict[str, dict] = {}

    def ref(self, citation: str) -> tuple[str, int]:
        """Register the first cited document; return (source_id, source_page)."""
        for title, _ in parse_citations(citation):
            self._by_id.setdefault(f"src-{slug(title)}", self._make(title))
        title, page = parse_citations(citation)[0]
        return f"src-{slug(title)}", page

    @staticmethod
    def _make(title: str) -> dict:
        return {
            "id": f"src-{slug(title)}",
            "title": title,
            "type": DEFAULT_SOURCE_TYPE,
            "provided_by": PROVIDED_BY,
            "file_hash": UNKNOWN_HASH,
        }

    def all(self) -> list[dict]:
        return sorted(self._by_id.values(), key=lambda s: s["id"])


def _load_yaml(path: Path):
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as e:
        raise ConversionError(f"cannot read {path}: {e}") from e


def read_lesson_file(path: Path) -> tuple[dict, str]:
    m = FRONT_MATTER.match(path.read_text(encoding="utf-8"))
    if not m:
        raise ConversionError(f"{path.name}: missing YAML front matter")
    try:
        meta = yaml.safe_load(m[1])
    except yaml.YAMLError as e:
        raise ConversionError(f"{path.name}: bad front matter: {e}") from e
    if not isinstance(meta, dict):
        raise ConversionError(f"{path.name}: front matter is not a mapping")
    return meta, m[2]


def split_pages(body: str) -> list[dict]:
    pages = [p.strip() for p in PAGE_SPLIT.split(body) if p.strip()]
    return [{"order": i, "body": p} for i, p in enumerate(pages, 1)]


# --- conversion -------------------------------------------------------------

def convert(repo_root: Path, generated_at: str) -> dict:
    topics_doc = _load_yaml(repo_root / "topics.yaml")
    quizzes_doc = _load_yaml(repo_root / "quizzes.yaml")
    media_doc = _load_yaml(repo_root / "media" / "media.yaml")
    sources = Sources()

    topics = [
        {
            "id": t["id"],
            "name": t["name"],
            "order": t["order"],
            # "tbd" is a placeholder; the icon name is still to be agreed with Frontend.
            "icon": None if t.get("icon") in (None, "", "tbd") else t["icon"],
            "subtopics": [
                {"id": s["id"], "name": s["name"], "order": s["order"], "lesson_ids": list(s["lessons"])}
                for s in t["subtopics"]
            ],
        }
        for t in topics_doc["topics"]
    ]

    lessons = []
    for lesson_id in [i for t in topics for s in t["subtopics"] for i in s["lesson_ids"]]:
        path = repo_root / "lessons" / f"{lesson_id}.md"
        if not path.is_file():
            raise ConversionError(f"topics.yaml lists {lesson_id} but {path} does not exist")
        meta, body = read_lesson_file(path)
        sources.ref(meta["source"])
        lessons.append({
            "id": meta["id"],
            "topic_id": meta["topic_id"],
            "subtopic_id": meta["subtopic_id"],
            "title": meta["title"],
            "est_minutes": meta["est_minutes"],
            "pages": split_pages(body),
            "key_takeaways": list(meta["key_takeaways"]),
            "images": [{"media_id": Path(i["file"]).stem, "page": i["page"]} for i in meta.get("images") or []],
            "claims": [],
            "checks": {"schema_valid": True, **readability(body.replace("---page---", ""))},
            "generated_by": "human",
            "status": "draft",
        })

    quizzes = []
    for q in quizzes_doc:
        source_id, source_page = sources.ref(q["source"])
        quizzes.append({
            "id": q["id"],
            "lesson_id": q["lesson_id"],
            "question": q["question"],
            "options": list(q["options"]),
            "answer": q["answer"],
            "feedback": q["feedback"],
            "source_id": source_id,
            "source_page": source_page,
            "source_quote": NO_QUOTE,
            "status": "draft",
        })

    media = []
    for m in media_doc:
        source_id, _ = sources.ref(m["source"])
        media.append({
            "id": Path(m["file"]).stem,
            "file": m["file"],
            "alt_text": m["alt_text"],
            "credit": m["credit"],
            "source_id": source_id,
        })

    return {
        "schema_version": "1.0",
        "run": {
            "run_id": generated_at[:10] + "-repo",
            "model": "none (human-written content)",
            "prompt_version": "convert-repo-content-v1",
            "generated_at": generated_at,
        },
        "disease": dict(topics_doc["disease"]),
        "sources": sources.all(),
        "topics": topics,
        "lessons": lessons,
        "quizzes": quizzes,
        "media": media,
    }


# --- validation -------------------------------------------------------------

def _dupes(label: str, ids: list[str]) -> list[str]:
    return [f"duplicate {label} id: {i}" for i, n in Counter(ids).items() if n > 1]


def validate_export(data: dict, schema: dict) -> list[str]:
    """Schema errors plus the cross-reference checks. Empty list = valid."""
    errors = [
        f"{'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message}"
        for e in sorted(Draft202012Validator(schema).iter_errors(data), key=lambda e: list(map(str, e.absolute_path)))
    ]
    if errors:
        return errors

    subtopics = {s["id"]: (t["id"], s) for t in data["topics"] for s in t["subtopics"]}
    lesson_ids = [l["id"] for l in data["lessons"]]
    source_ids = {s["id"] for s in data["sources"]}
    media_ids = {m["id"] for m in data["media"]}
    lessons = {l["id"]: l for l in data["lessons"]}

    errors += _dupes("topic", [t["id"] for t in data["topics"]])
    errors += _dupes("subtopic", [s["id"] for t in data["topics"] for s in t["subtopics"]])
    errors += _dupes("lesson", lesson_ids)
    errors += _dupes("quiz", [q["id"] for q in data["quizzes"]])
    errors += _dupes("media", [m["id"] for m in data["media"]])
    errors += _dupes("source", [s["id"] for s in data["sources"]])
    errors += _dupes("claim", [c["id"] for l in data["lessons"] for c in l["claims"]])

    listed = Counter(i for _, s in subtopics.values() for i in s["lesson_ids"])
    for t in data["topics"]:
        for s in t["subtopics"]:
            for i in s["lesson_ids"]:
                if i not in lessons:
                    errors.append(f"subtopic {s['id']} lists unknown lesson {i}")
                elif (lessons[i]["topic_id"], lessons[i]["subtopic_id"]) != (t["id"], s["id"]):
                    errors.append(f"lesson {i} is listed in {s['id']} but says it belongs to {lessons[i]['subtopic_id']}")
    for i in lesson_ids:
        if listed[i] != 1:
            errors.append(f"lesson {i} appears in {listed[i]} subtopic lesson_ids (expected 1)")

    for l in data["lessons"]:
        if l["subtopic_id"] not in subtopics:
            errors.append(f"lesson {l['id']}: unknown subtopic_id {l['subtopic_id']}")
        elif subtopics[l["subtopic_id"]][0] != l["topic_id"]:
            errors.append(f"lesson {l['id']}: subtopic {l['subtopic_id']} is not in topic {l['topic_id']}")
        if [p["order"] for p in l["pages"]] != list(range(1, len(l["pages"]) + 1)):
            errors.append(f"lesson {l['id']}: page orders must be 1..n")
        errors += _dupes(f"lesson {l['id']} image", [i["media_id"] for i in l.get("images", [])])
        for img in l.get("images", []):
            if img["media_id"] not in media_ids:
                errors.append(f"lesson {l['id']}: unknown media_id {img['media_id']}")
            if img["page"] > len(l["pages"]):
                errors.append(f"lesson {l['id']}: image on page {img['page']} but only {len(l['pages'])} pages")
        for c in l["claims"]:
            if c["source_id"] not in source_ids:
                errors.append(f"claim {c['id']}: unknown source_id {c['source_id']}")
            if c["page"] > len(l["pages"]):
                errors.append(f"claim {c['id']}: page {c['page']} out of range")

    for q in data["quizzes"]:
        if q["lesson_id"] not in lessons:
            errors.append(f"quiz {q['id']}: unknown lesson_id {q['lesson_id']}")
        if q["source_id"] not in source_ids:
            errors.append(f"quiz {q['id']}: unknown source_id {q['source_id']}")
        if q["answer"] >= len(q["options"]):
            errors.append(f"quiz {q['id']}: answer {q['answer']} is not a valid option index")
    for m in data["media"]:
        if m["source_id"] not in source_ids:
            errors.append(f"media {m['id']}: unknown source_id {m['source_id']}")
    return errors


# --- CLI --------------------------------------------------------------------

def find_upwards(start: Path, relative: str) -> Path | None:
    for d in [start, *start.parents]:
        if (d / relative).exists():
            return d / relative
    return None


def main(argv: list[str] | None = None) -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--repo-root", type=Path, help="folder holding topics.yaml (default: searched upwards)")
    ap.add_argument("--schema", type=Path, help="content.schema.json (default: searched upwards)")
    ap.add_argument("--out", type=Path, help="output JSON (default: backend/exports/export_<disease>_<yyyymmdd>_repo.json)")
    ap.add_argument("--dry-run", action="store_true", help="validate and print the summary; write nothing")
    args = ap.parse_args(argv)

    try:
        root = args.repo_root
        if root is None:
            found = find_upwards(here, "topics.yaml")
            if not found:
                raise ConversionError("topics.yaml not found; pass --repo-root")
            root = found.parent
        schema_path = args.schema or find_upwards(here, "schema/content.schema.json")
        if not schema_path:
            raise ConversionError("schema/content.schema.json not found; pass --schema")
        schema = json.loads(Path(schema_path).read_text(encoding="utf-8"))

        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        data = convert(Path(root), now)
        errors = validate_export(data, schema)
    except (ConversionError, KeyError, TypeError) as e:
        print(f"ERROR: {type(e).__name__}: {e}", file=sys.stderr)
        return 1
    if errors:
        print(f"ERROR: export is invalid ({len(errors)} problems); nothing written", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    n_sub = sum(len(t["subtopics"]) for t in data["topics"])
    print(f"{len(data['topics'])} topics, {n_sub} subtopics, {len(data['lessons'])} lessons, "
          f"{len(data['quizzes'])} quizzes, {len(data['media'])} media, {len(data['sources'])} sources")
    print("lesson status:", dict(Counter(l["status"] for l in data["lessons"])))

    if args.dry_run:
        print("dry run: nothing written")
        return 0
    out = args.out or here.parent / "exports" / f"export_{data['disease']['id']}_{now[:10].replace('-', '')}_repo.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(out.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, out)
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

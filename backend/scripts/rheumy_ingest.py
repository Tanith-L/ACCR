"""Load the passages Rheumy answers from into Supabase (docs/rheumy-chatbot.md).

    python backend/scripts/rheumy_ingest.py --dry-run          # build and summarize only
    python backend/scripts/rheumy_ingest.py                    # send to the rheumy-ingest function
    python backend/scripts/rheumy_ingest.py --write-json out.json

Passages come from the lesson library (every page of every lesson, plus its key
takeaways) and from the source documents the lessons cite (SOURCES below). Documents
the source review marks "background only" or "design reference" are left out.

The rheumy-ingest Edge Function makes the embeddings (gte-small, the same model
rheumy-chat uses for questions), upserts the passages, skips unchanged ones and,
at the end, deletes passages that are no longer produced. Run it again whenever the
lessons or sources change. Nothing is sent with --dry-run.

Settings (environment or .env): SUPABASE_URL, SUPABASE_SERVICE_KEY (the secret key,
sent only to our own Edge Function).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

from contract import find_upwards

LIBRARY = "data/psa/chapter/psa-content.json"
EXTRACTED = "data/psa/extracted"
# Source documents with patient-relevant text: (source id, file in data/psa/extracted).
# Titles come from the library's source list so citations match the lessons.
SOURCES = [
    ("src-management-guidelines-of-arthritis-and-autoimmune-diseases",
     "src-management-guidelines-of-arthritis-and-autoimmune-diseases.txt"),
    ("src-murphys-laws-of-arthritis-preface", "src-murphys-laws-of-arthritis-preface.txt"),
    ("src-the-four-pillars-of-arthritis", "src-the-four-pillars-of-arthritis.txt"),
    ("src-rheumnotes-anatomy-2026", "RheumNotes_Anatomy_White_Paper.txt"),
    ("src-rheumnotes-chart-2026", "RheumNotes_Anatomy_Chart.txt"),
    ("src-rheumnotes-mind-2026", "RheumNotes_Mind_Mastery_White_Paper.txt"),
    ("src-rheumnotes-motion-2026", "RheumNotes_Motion_White_Paper.txt"),
    ("src-rheumnotes-nutrition-2026", "RheumNotes_Nutrition_White_Paper_2026-11-17.txt"),
    ("src-rheumnotes-sleep-2026", "RheumNotes_Sleep_Restore_White_Paper.txt"),
]
TARGET_CHARS = 1100   # about 250 words; gte-small reads up to 512 tokens
MAX_CHARS = 1600
OVERLAP_CHARS = 200
BATCH = 16            # passages per request (the function embeds one by one)
ID_RE = re.compile(r"^[a-z0-9-]+#\d+$")


def _clean(text: str) -> str:
    text = text.replace("\r\n", "\n").replace(" ", " ")
    # Reference markers from the extracted documents ("[29]", "[paragraph 42]") mean nothing to a reader.
    text = re.sub(r"\[(?:paragraph\s+)?\d+(?:[,–-]\s*\d+)*\]", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_passages(text: str, target: int = TARGET_CHARS, limit: int = MAX_CHARS,
                   overlap: int = OVERLAP_CHARS) -> list[str]:
    """Split on paragraphs into passages of about `target` characters (never over `limit`).
    A paragraph longer than `limit` is split on sentences, then on words. Consecutive
    passages share up to `overlap` characters so an idea cut at a boundary is still found."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", _clean(text)) if p.strip()]
    pieces: list[str] = []
    for p in paragraphs:
        if len(p) <= limit:
            pieces.append(p)
            continue
        sentence_buf = ""
        for s in re.split(r"(?<=[.!?])\s+", p):
            while len(s) > limit:  # a single very long "sentence": cut on a word boundary
                cut = s.rfind(" ", 0, limit)
                cut = cut if cut > 0 else limit
                pieces.append(s[:cut].strip())
                s = s[cut:].strip()
            if sentence_buf and len(sentence_buf) + 1 + len(s) > target:
                pieces.append(sentence_buf)
                sentence_buf = s
            else:
                sentence_buf = f"{sentence_buf} {s}".strip()
        if sentence_buf:
            pieces.append(sentence_buf)

    passages: list[str] = []
    buf = ""
    for piece in pieces:
        if buf and len(buf) + 2 + len(piece) > target:
            passages.append(buf)
            tail = buf[-overlap:]
            tail = tail[tail.find(" ") + 1:] if " " in tail else ""
            buf = f"{tail}\n\n{piece}".strip() if tail and len(tail) + 2 + len(piece) <= limit else piece
        else:
            buf = f"{buf}\n\n{piece}".strip()
    if buf:
        passages.append(buf)
    return passages


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def build_chunks(root: Path) -> list[dict]:
    """All passages, in a stable order with stable IDs."""
    library = json.loads((root / LIBRARY).read_text(encoding="utf-8"))
    titles = {s["id"]: s["title"] for s in library["sources"]}
    chunks: list[dict] = []

    for lesson in library["lessons"]:
        n = 0
        for page in sorted(lesson["pages"], key=lambda p: p["order"]):
            for passage in split_passages(page["body"]):
                n += 1
                chunks.append({
                    "id": f"{lesson['id']}#{n}", "kind": "lesson", "source_id": lesson["id"],
                    "title": lesson["title"], "locator": f"Page {page['order']}",
                    "lesson_status": lesson.get("status"), "content": passage,
                })
        if lesson.get("key_takeaways"):
            n += 1
            chunks.append({
                "id": f"{lesson['id']}#{n}", "kind": "lesson", "source_id": lesson["id"],
                "title": lesson["title"], "locator": "Key takeaways",
                "lesson_status": lesson.get("status"),
                "content": "Key takeaways:\n" + "\n".join(f"- {t}" for t in lesson["key_takeaways"]),
            })

    for source_id, filename in SOURCES:
        if source_id not in titles:
            raise ValueError(f"{source_id} is not in the library's source list")
        path = root / EXTRACTED / filename
        if not path.is_file():
            raise FileNotFoundError(f"missing extracted text for {source_id}: {path}")
        passages = split_passages(path.read_text(encoding="utf-8"))
        for i, passage in enumerate(passages, 1):
            chunks.append({
                "id": f"{source_id}#{i}", "kind": "source", "source_id": source_id,
                "title": titles[source_id], "locator": f"Part {i} of {len(passages)}",
                "lesson_status": None, "content": passage,
            })

    for c in chunks:
        c["content_sha256"] = _sha(c["title"] + "\n" + c["content"])
    check_chunks(chunks)
    return chunks


def check_chunks(chunks: list[dict]) -> None:
    errors = []
    seen = set()
    for c in chunks:
        if not ID_RE.match(c["id"]):
            errors.append(f"bad id {c['id']!r}")
        if c["id"] in seen:
            errors.append(f"duplicate id {c['id']}")
        seen.add(c["id"])
        if not c["content"].strip():
            errors.append(f"{c['id']}: empty passage")
        if len(c["content"]) > MAX_CHARS + OVERLAP_CHARS + 2:
            errors.append(f"{c['id']}: passage is {len(c['content'])} characters")
    if errors:
        raise ValueError("; ".join(errors[:10]))


def summarize(chunks: list[dict]) -> str:
    lessons = [c for c in chunks if c["kind"] == "lesson"]
    sources = [c for c in chunks if c["kind"] == "source"]
    by_source: dict[str, int] = {}
    for c in sources:
        by_source[c["source_id"]] = by_source.get(c["source_id"], 0) + 1
    lines = [f"{len(chunks)} passages: {len(lessons)} from {len({c['source_id'] for c in lessons})} lessons, "
             f"{len(sources)} from {len(by_source)} source documents"]
    lines += [f"  {sid}: {n}" for sid, n in by_source.items()]
    sizes = sorted(len(c["content"]) for c in chunks)
    lines.append(f"passage length: median {sizes[len(sizes) // 2]}, max {sizes[-1]} characters")
    return "\n".join(lines)


def load_settings(start: Path) -> dict:
    """Environment variables win over the nearest .env file above the script."""
    from dotenv import dotenv_values

    env_file = find_upwards(start, ".env")
    values = dict(dotenv_values(env_file)) if env_file else {}
    values.update({k: os.environ[k] for k in os.environ if k.startswith("SUPABASE_")})
    return values


def post(url: str, key: str, body: dict, timeout: int = 150) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), method="POST", headers={
        "Content-Type": "application/json", "apikey": key,
        **({"Authorization": f"Bearer {key}"} if key.count(".") == 2 else {}),  # legacy JWT keys
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:500]
        raise RuntimeError(f"rheumy-ingest answered {e.code}: {detail}") from None


def upload(chunks: list[dict], supabase_url: str, key: str) -> dict:
    url = supabase_url.rstrip("/") + "/functions/v1/rheumy-ingest"
    totals = {"embedded": 0, "unchanged": 0}
    for i in range(0, len(chunks), BATCH):
        result = post(url, key, {"action": "upsert", "chunks": chunks[i:i + BATCH]})
        totals["embedded"] += result.get("embedded", 0)
        totals["unchanged"] += result.get("unchanged", 0)
        print(f"  {min(i + BATCH, len(chunks))}/{len(chunks)} passages sent")
    result = post(url, key, {"action": "prune", "keep_ids": [c["id"] for c in chunks]})
    totals["deleted"] = result.get("deleted", 0)
    return totals


def main(argv: list[str] | None = None) -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--dry-run", action="store_true", help="build and summarize only; send nothing")
    ap.add_argument("--write-json", type=Path, help="also write the passages to this JSON file")
    ap.add_argument("--root", type=Path, help="repository root (default: found upwards)")
    args = ap.parse_args(argv)

    root = args.root or find_upwards(here, LIBRARY.split("/")[0]).parent
    try:
        chunks = build_chunks(root)
    except (ValueError, FileNotFoundError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    print(summarize(chunks))
    if args.write_json:
        args.write_json.write_text(json.dumps(chunks, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"wrote {args.write_json}")
    if args.dry_run:
        print("dry run: nothing sent")
        return 0

    settings = load_settings(here)
    missing = [k for k in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY") if not settings.get(k)]
    if missing:
        print("ERROR: missing settings (environment or .env): " + ", ".join(missing), file=sys.stderr)
        return 2
    try:
        totals = upload(chunks, settings["SUPABASE_URL"], settings["SUPABASE_SERVICE_KEY"])
    except (RuntimeError, urllib.error.URLError, TimeoutError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    print(f"done: {totals['embedded']} embedded, {totals['unchanged']} unchanged, {totals['deleted']} deleted")
    return 0


if __name__ == "__main__":
    sys.exit(main())

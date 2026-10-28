"""Inventory the supplied References folder and build the six-part content map.

This is source preparation, not an LLM drafting or clinical-validation service.
It never executes reference files or connects to the backend database.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
from io import BytesIO
import json
from pathlib import Path, PurePosixPath
import re
import sys
from xml.etree import ElementTree as ET
from zipfile import ZipFile

import yaml

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "psa"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
ROLES = {"educational_candidate", "historical_background", "workflow_reference", "ux_reference", "prototype_asset"}


def safe_path(root: Path, relative: str) -> Path:
    parts = PurePosixPath(relative)
    if parts.is_absolute() or ".." in parts.parts or "\\" in relative or ":" in relative:
        raise ValueError(f"Unsafe relative path: {relative}")
    path = root.joinpath(*parts.parts).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError(f"Path escapes output directory: {relative}")
    return path


def load_plan() -> tuple[dict, dict]:
    plan = yaml.safe_load((DATA / "organization.yaml").read_text(encoding="utf-8"))
    topics = yaml.safe_load((ROOT / "topics.yaml").read_text(encoding="utf-8"))["topics"]
    topic_map = {t["id"]: t for t in topics}
    sources = {s["id"]: s for s in plan["sources"]}
    if len(sources) != len(plan["sources"]):
        raise ValueError("Duplicate source ID")
    if len({s["file"].casefold() for s in sources.values()}) != len(sources):
        raise ValueError("Duplicate source filename")
    for source in sources.values():
        safe_path(DATA / "originals", source["file"])
        if source["role"] not in ROLES:
            raise ValueError(f"Unknown role: {source['role']}")
    parts = plan["parts"]
    if [p["order"] for p in parts] != list(range(1, 7)):
        raise ValueError("Expected six parts in order 1..6")
    if Counter(p["topic_id"] for p in parts) != Counter({k: 1 for k in topic_map}):
        raise ValueError("Parts must map to each existing topic exactly once")
    if len({p["folder"] for p in parts}) != len(parts):
        raise ValueError("Duplicate part folder")
    lessons = {}
    for topic in topics:
        for subtopic in topic["subtopics"]:
            for lid in subtopic["lessons"]:
                if lid in lessons:
                    raise ValueError(f"Duplicate lesson ID in topics.yaml: {lid}")
                lessons[lid] = {"id": lid, "topic_id": topic["id"], "subtopic_id": subtopic["id"]}
    # Taxonomy IDs remain valid when a legacy lesson file has been removed.
    for path in sorted((ROOT / "lessons").glob("*.md")):
        match = re.match(r"\A---\s*\n(.*?)\n---\s*\n", path.read_text(encoding="utf-8"), re.S)
        if not match:
            raise ValueError(f"Missing front matter: {path.name}")
        meta = yaml.safe_load(match[1])
        if meta["id"] != path.stem or meta["id"] not in lessons:
            raise ValueError(f"Unknown or mismatched lesson ID: {path.name}")
        for key in ("topic_id", "subtopic_id"):
            if meta[key] != lessons[meta["id"]][key]:
                raise ValueError(f"Broken lesson hierarchy: {meta['id']}")
    assigned = []
    for part in parts:
        safe_path(DATA / "parts", part["folder"])
        topic = topic_map[part["topic_id"]]
        if part["order"] != topic["order"]:
            raise ValueError(f"Topic order mismatch: {topic['id']}")
        expected = [lid for sub in topic["subtopics"] for lid in sub["lessons"]]
        if part["lessons"] != expected:
            raise ValueError(f"Lesson order/membership mismatch: {topic['id']}")
        for sub in topic["subtopics"]:
            for lid in sub["lessons"]:
                meta = lessons.get(lid, {})
                if (meta.get("topic_id"), meta.get("subtopic_id")) != (topic["id"], sub["id"]):
                    raise ValueError(f"Broken lesson hierarchy: {lid}")
        assigned.extend(part["lessons"])
        allowed = set(part["lessons"] + part["related_lessons"])
        if not allowed <= lessons.keys():
            raise ValueError(f"Unknown related lesson in {topic['id']}")
        for material in part["materials"]:
            if material["source_id"] not in sources:
                raise ValueError(f"Unknown source: {material['source_id']}")
            if sources[material["source_id"]]["role"] not in {"educational_candidate", "historical_background"}:
                raise ValueError("Non-clinical asset used as educational evidence")
        for card in part["cards"]:
            if card["coverage"] not in {"available", "partial", "missing"}:
                raise ValueError(f"Unknown coverage label: {card['title']}")
            if not set(card["lesson_ids"]) <= allowed:
                raise ValueError(f"Unknown/unlisted cross-link: {card['title']}")
            if card["coverage"] == "missing" and card["lesson_ids"]:
                raise ValueError("A missing card must not introduce placeholder lessons")
        for faq in part.get("faq_prompts", []):
            if not set(faq["related_lesson_ids"]) <= lessons.keys():
                raise ValueError(f"Unknown FAQ lesson: {faq['question']}")
    if Counter(assigned) != Counter({lid: 1 for lid in lessons}):
        raise ValueError("Every existing lesson must have exactly one primary part")
    return plan, lessons


def extract_text(raw: bytes, suffix: str) -> tuple[str | None, dict]:
    if suffix == ".docx":
        with ZipFile(BytesIO(raw)) as document:
            xml = ET.fromstring(document.read("word/document.xml"))
        paragraphs = ["".join(n.text or "" for n in p.iter(W + "t")) for p in xml.iter(W + "p")]
        text = "\n\n".join(f"[paragraph {i}] {p}" for i, p in enumerate(paragraphs, 1) if p.strip())
        return text, {"locator_kind": "docx_paragraph", "paragraph_count": len(paragraphs),
                      "cached_page_breaks": len(list(xml.iter(W + "lastRenderedPageBreak"))),
                      "page_numbers_verified": False}
    if suffix == ".pdf":
        from pypdf import PdfReader
        pdf = PdfReader(BytesIO(raw))
        pages = [(p.extract_text() or "").replace("\r\n", "\n").replace("\r", "\n").strip()
                 for p in pdf.pages]
        text = "\n\n".join(f"[page {i}]\n{p or '[no extractable text; transcription required]'}"
                            for i, p in enumerate(pages, 1))
        return text, {"locator_kind": "pdf_page", "page_count": len(pages),
                      "pages_with_text": sum(bool(p) for p in pages),
                      "text_quality": "unverified; a text layer can contain garbled characters",
                      "needs_transcription": any(not p for p in pages)}
    if suffix in {".jpeg", ".jpg", ".png"}:
        return None, {"locator_kind": "image", "needs_transcription": True}
    return None, {"locator_kind": "asset", "clinical_text_extracted": False}


def prepare(archive: Path, plan: dict) -> tuple[list[dict], dict[Path, bytes]]:
    records, outputs = [], {}
    with ZipFile(archive) as zipped:
        members = {}
        for info in zipped.infolist():
            if info.is_dir() or "/References/" not in info.filename:
                continue
            relative = info.filename.split("/References/", 1)[1]
            safe_path(DATA / "originals", relative)
            if relative in members:
                raise ValueError(f"Duplicate archive member: {relative}")
            members[relative] = info
        expected = {s["file"] for s in plan["sources"]}
        if expected != set(members):
            raise ValueError(f"Source inventory mismatch; missing={sorted(expected-set(members))}; "
                             f"unmapped={sorted(set(members)-expected)}")
        for source in plan["sources"]:
            info = members[source["file"]]
            raw = zipped.read(info)
            target = safe_path(DATA / "originals", source["file"])
            digest = hashlib.sha256(raw).hexdigest()
            if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() != digest:
                raise ValueError(f"Existing original differs; preserve it and review the new source: {source['file']}")
            suffix = target.suffix.lower()
            types = {".pdf": "pdf", ".docx": "docx", ".png": "image", ".jpg": "image", ".jpeg": "image"}
            text, extraction = extract_text(raw, suffix)
            record = {**source, "archive_member": info.filename,
                      "local_file": target.relative_to(ROOT).as_posix(),
                      "file_hash": digest, "bytes": len(raw),
                      "type": types.get(suffix, "asset"), "clinical_approval": "not_recorded",
                      "part_ids": [p["topic_id"] for p in plan["parts"]
                                   if any(m["source_id"] == source["id"] for m in p["materials"])],
                      "extraction": extraction}
            outputs[target] = raw
            if text is not None:
                text_path = DATA / "extracted" / f"{source['id']}.txt"
                outputs[text_path] = (text + "\n").encode("utf-8")
                record["extracted_file"] = text_path.relative_to(ROOT).as_posix()
            records.append(record)
    return records, outputs


def validate_local(plan: dict, lessons: dict) -> None:
    records = json.loads((DATA / "source-inventory.json").read_text(encoding="utf-8"))
    expected = {s["id"]: s for s in plan["sources"]}
    if Counter(r["id"] for r in records) != Counter({sid: 1 for sid in expected}):
        raise ValueError("Saved source IDs do not match organization.yaml")
    for record in records:
        source = expected[record["id"]]
        if any(record[k] != v for k, v in source.items()):
            raise ValueError(f"Stale source metadata: {source['id']}")
        path = safe_path(ROOT, record["local_file"])
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != record["file_hash"] or len(raw) != record["bytes"]:
            raise ValueError(f"Source hash/size mismatch: {path.name}")
        expected_parts = [p["topic_id"] for p in plan["parts"] if any(m["source_id"] == source["id"] for m in p["materials"])]
        if record["part_ids"] != expected_parts:
            raise ValueError(f"Stale source-to-part mapping: {source['id']}")
        if "extracted_file" in record:
            text, extraction = extract_text(raw, path.suffix.lower())
            saved = safe_path(ROOT, record["extracted_file"]).read_text(encoding="utf-8")
            if saved != text + "\n" or record["extraction"] != extraction:
                raise ValueError(f"Stale extracted text: {source['id']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--archive", type=Path, help="ZIP containing the References directory")
    action.add_argument("--validate", action="store_true", help="Validate saved hashes and classification mappings")
    parser.add_argument("--dry-run", action="store_true", help="Inspect and validate without writing")
    args = parser.parse_args()
    try:
        plan, lessons = load_plan()
        if args.validate:
            validate_local(plan, lessons)
        else:
            records, outputs = prepare(args.archive, plan)
            inventory = DATA / "source-inventory.json"
            outputs[inventory] = (json.dumps(records, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
            # All source, archive and hierarchy checks finish before any writes.
            if not args.dry_run:
                for path, raw in outputs.items():
                    path.parent.mkdir(parents=True, exist_ok=True)
                    temporary = path.with_name(path.name + ".tmp")
                    temporary.write_bytes(raw)
                    temporary.replace(path)
        counts = Counter(card["coverage"] for p in plan["parts"] for card in p["cards"])
        print(f"VALID: {len(plan['sources'])} source/asset records; 6 parts; {len(lessons)} registered lesson IDs; 0 broken relationships")
        print("Editorial card coverage:", dict(counts))
        print("Clinical approval and factual claim validation: not assessed by this tool")
        if args.dry_run:
            print("Dry run: nothing written")
        return 0
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

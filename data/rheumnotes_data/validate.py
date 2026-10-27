"""Bundle validation: JSON Schema + cross-record (structural) rules.

Used by the pipeline before export, by `python -m rheumnotes_data validate`,
and by the backend importer before anything touches the database.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

from .paths import MEDIA_DIR, SCHEMA_PATH


@dataclass
class ValidationReport:
    schema_errors: list[str] = field(default_factory=list)
    structure_errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.schema_errors and not self.structure_errors

    def summary(self) -> str:
        lines = [f"schema errors: {len(self.schema_errors)}",
                 f"structure errors: {len(self.structure_errors)}",
                 f"warnings: {len(self.warnings)}"]
        lines += [f"  [schema] {e}" for e in self.schema_errors]
        lines += [f"  [structure] {e}" for e in self.structure_errors]
        lines += [f"  [warning] {w}" for w in self.warnings]
        return "\n".join(lines)


@lru_cache(maxsize=1)
def _validator() -> Draft202012Validator:
    schema = json.loads(SCHEMA_PATH.read_text())
    return Draft202012Validator(schema, format_checker=FormatChecker())


def schema_errors(bundle: dict) -> list[str]:
    errors = sorted(_validator().iter_errors(bundle), key=lambda e: list(e.absolute_path))
    return [f"{'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message}" for e in errors]


def structure_errors(bundle: dict, media_dir: Path | None = MEDIA_DIR) -> tuple[list[str], list[str]]:
    """Rules JSON Schema can't express: unique IDs, references, ordering."""
    errors: list[str] = []
    warnings: list[str] = []

    source_ids = [s["id"] for s in bundle.get("sources", [])]
    topic_ids = [t["id"] for t in bundle.get("topics", [])]
    subtopics = {st["id"]: (t["id"], st) for t in bundle.get("topics", []) for st in t.get("subtopics", [])}
    lessons = bundle.get("lessons", [])
    lesson_ids = [l["id"] for l in lessons]

    for label, ids in (("source", source_ids), ("topic", topic_ids), ("lesson", lesson_ids),
                       ("subtopic", [sid for t in bundle.get("topics", []) for sid in
                                     (st["id"] for st in t.get("subtopics", []))])):
        dupes = {i for i in ids if ids.count(i) > 1}
        if dupes:
            errors.append(f"duplicate {label} ids: {sorted(dupes)}")

    _check_unique_order(errors, "topic", bundle.get("topics", []))
    for t in bundle.get("topics", []):
        _check_unique_order(errors, f"subtopic in {t['id']}", t.get("subtopics", []))

    by_id = {l["id"]: l for l in lessons}
    listed: set[str] = set()
    for sub_id, (topic_id, st) in subtopics.items():
        for pos, lid in enumerate(st["lesson_ids"], start=1):
            listed.add(lid)
            lesson = by_id.get(lid)
            if lesson is None:
                errors.append(f"subtopic {sub_id} lists unknown lesson {lid}")
                continue
            if lesson["subtopic_id"] != sub_id or lesson["topic_id"] != topic_id:
                errors.append(f"lesson {lid} is listed under {topic_id}/{sub_id} but says "
                              f"{lesson['topic_id']}/{lesson['subtopic_id']}")
            if lesson["order"] != pos:
                errors.append(f"lesson {lid} has order {lesson['order']} but is #{pos} in {sub_id}")

    known_sources = set(source_ids)
    for l in lessons:
        if l["id"] not in listed:
            errors.append(f"lesson {l['id']} is not listed in any subtopic")
        if l["subtopic_id"] not in subtopics:
            errors.append(f"lesson {l['id']} references unknown subtopic {l['subtopic_id']}")
        for ref in l.get("source_refs", []):
            if ref["source_id"] not in known_sources:
                errors.append(f"lesson {l['id']} cites unknown source {ref['source_id']}")
        for claim in l.get("claims", []):
            if claim["source_id"] not in known_sources:
                errors.append(f"lesson {l['id']} claim cites unknown source {claim['source_id']}")
        for q in l.get("quiz", []):
            if not 0 <= q["answer"] < len(q["options"]):
                errors.append(f"quiz {q['id']} answer index {q['answer']} out of range")
        if media_dir is not None:
            for img in l.get("images", []):
                if not (media_dir / img["file"]).exists():
                    warnings.append(f"lesson {l['id']} image not found in media/: {img['file']}")

    return errors, warnings


def _check_unique_order(errors: list[str], label: str, items: list[dict]) -> None:
    orders = [i["order"] for i in items]
    if sorted(orders) != list(range(1, len(orders) + 1)):
        errors.append(f"{label} order must be 1..{len(orders)} without gaps, got {orders}")


def validate_bundle(bundle: dict, media_dir: Path | None = MEDIA_DIR) -> ValidationReport:
    report = ValidationReport(schema_errors=schema_errors(bundle))
    # Structural checks assume the shape is right; skip them if the schema already failed.
    if not report.schema_errors:
        report.structure_errors, report.warnings = structure_errors(bundle, media_dir)
    return report


def validate_file(path: Path, media_dir: Path | None = MEDIA_DIR) -> ValidationReport:
    return validate_bundle(json.loads(Path(path).read_text()), media_dir)

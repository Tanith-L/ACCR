"""Validate API exports against original sources and recorded API evidence.

For the current authored library, use build_psa_library.py --validate.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.content_processing import (
    ROOT, assemble, check_judge, digest, evaluate, init_readability, read_json, validate_content,
)

def validate_run(directory):
    directory = Path(directory)
    exports = [path for path in directory.glob("*.json") if path.name != "evidence.json"]
    if len(exports) != 1:
        return ["Expected exactly one export JSON in the run directory."]
    data = read_json(exports[0])
    evidence_path = directory / "evidence.json"
    if not evidence_path.is_file():
        return ["API run requires evidence.json; validate the current library with build_psa_library.py --validate."]
    evidence = read_json(evidence_path)
    manifest, sources = evidence["manifest"], evidence["sources"]
    errors = []
    if digest(data) != evidence["export_sha256"]:
        errors.append("export changed since the recorded API run.")
    inventory = {s["id"]: s for s in read_json(ROOT / "data/psa/source-inventory.json")}
    expected_hashes = {sid: inventory[sid]["file_hash"] for sid in manifest["source_ids"]}
    if sources["source_hashes"] != expected_hashes:
        errors.append("Evidence source hashes differ from the source registry.")
    if {s["id"]: s["file_hash"] for s in data["sources"]} != expected_hashes:
        errors.append("Export sources differ from the selected original sources.")
    records = [inventory[sid] for sid in manifest["source_ids"]]
    for source in records:
        if digest((ROOT / source["local_file"]).read_bytes()) != source["file_hash"]:
            errors.append(f"{source['id']}: original file changed.")

    taxonomy = yaml.safe_load((ROOT / "topics.yaml").read_text(encoding="utf-8"))
    topic = next(t for t in taxonomy["topics"] if t["id"] == manifest["topic_id"])
    sub = next(s for s in topic["subtopics"] if s["id"] == manifest["subtopic_id"])
    selected = [l["id"] for l in manifest["lessons"]]
    if selected != [i for i in sub["lessons"] if i in selected]:
        errors.append("Manifest lesson IDs/order differ from topics.yaml.")
    expected = {k: topic[k] for k in ("id", "name", "order")}
    expected["subtopics"] = [{**{k: sub[k] for k in ("id", "name", "order")}, "lesson_ids": selected}]
    errors += validate_content(data, sources["pages"], expected)
    if data["disease"] != taxonomy["disease"]:
        errors.append("Disease differs from topics.yaml.")
    if [l["id"] for l in data["lessons"]] != selected:
        errors.append("Export lesson order differs from the manifest.")
    if errors:
        return errors
    init_readability()
    for spec, exported in zip(manifest["lessons"], data["lessons"], strict=True):
        drafts = [c for c in evidence["calls"] if c["stage"].startswith(f"draft-{spec['id']}-")]
        judges = [c for c in evidence["calls"] if c["stage"].startswith(f"judge-{spec['id']}-")]
        if not drafts or not judges:
            errors.append(f"{spec['id']}: missing API drafting or assessment evidence.")
            continue
        lesson, quizzes = assemble(drafts[-1]["result"], spec, manifest)
        judge = judges[-1]["result"]
        check_judge(judge, lesson, quizzes, spec["concepts"])
        pages = [p for p in sources["pages"] if p["source_id"] in spec["source_ids"]]
        _, problems = evaluate(lesson, quizzes, pages, judge)
        errors += problems
        exported_quizzes = [q for q in data["quizzes"] if q["lesson_id"] == lesson["id"]]
        if lesson != exported or quizzes != exported_quizzes:
            errors.append(f"{spec['id']}: export differs from API drafts and assessments.")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_directory", type=Path)
    args = parser.parse_args()
    try:
        errors = validate_run(args.run_directory)
    except Exception as error:
        errors = [f"{type(error).__name__}: {error}"]
    if errors:
        print("Validation failed:\n" + "\n".join(f"- {e}" for e in errors), file=sys.stderr)
        return 1
    print("PASS: schema, IDs/order, original hashes, quotes, assessment evidence, and reading level.")
    print("Lessons are draft or checked (automated checks only). Human and clinical reviews are pending.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

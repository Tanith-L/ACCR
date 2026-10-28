"""Validate core exports against original sources and their authored evidence."""
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

DEFAULT_INPUT = ROOT / "data/psa/assisted-input/symptoms.json"
DEFAULT_MANIFEST = ROOT / "data/psa/week9-sample.yaml"


def validate_run(directory, input_path=DEFAULT_INPUT, manifest_path=DEFAULT_MANIFEST):
    directory = Path(directory)
    exports = [path for path in directory.glob("*.json") if path.name != "evidence.json"]
    if len(exports) != 1:
        return ["Expected exactly one export JSON in the run directory."]
    data = read_json(exports[0])
    evidence_path = directory / "evidence.json"
    api = evidence_path.exists()
    evidence = read_json(evidence_path) if api else read_json(input_path)
    manifest = evidence["manifest"] if api else yaml.safe_load(Path(manifest_path).read_text(encoding="utf-8"))
    sources = evidence["sources"] if api else {"source_hashes": evidence["source_hashes"], "pages": evidence["pages"]}
    errors = []
    if api and digest(data) != evidence["export_sha256"]:
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
    if errors:
        return errors
    init_readability()
    if not api:
        from pipeline.assemble_assisted_content import assemble_bundle
        rebuilt, _ = assemble_bundle(evidence, manifest, taxonomy["disease"], expected, records)
        if any(rebuilt[k] != data[k] for k in data if k != "run"):
            errors.append("Export differs from the current assisted input; rebuild after editing content or assessments.")
        if any(rebuilt["run"][k] != data["run"][k] for k in ("model", "prompt_version")):
            errors.append("Export model/prompt provenance differs from assisted input.")
    else:
        if [l["id"] for l in data["lessons"]] != selected:
            errors.append("Export lesson order differs from the manifest.")
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
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Canonical interactive-AI input, when no API evidence file exists.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args()
    try:
        errors = validate_run(args.run_directory, args.input, args.manifest)
    except Exception as error:
        errors = [f"{type(error).__name__}: {error}"]
    if errors:
        print("Validation failed:\n" + "\n".join(f"- {e}" for e in errors), file=sys.stderr)
        return 1
    print("PASS: schema, IDs/order, original hashes, quotes, assessment evidence, and reading level.")
    print("All lessons remain drafts. Human and clinical reviews are pending.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

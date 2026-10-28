"""Validate and export saved interactive-AI drafts without making API calls."""
from __future__ import annotations

import argparse
import copy
import platform
import sys
import time
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.content_processing import (
    ROOT, assemble, chapter_output_names, check_judge, digest, evaluate, init_readability, load_plan,
    normalized, read_json, source_records, validate_content, write_json,
)
from pipeline.process_psa_content import render_deliverables


def assemble_bundle(bundle, plan, disease, topic, records):
    """The caller supplies authored evidence; Python never invents support labels."""
    if bundle["version"] != 1 or bundle["mode"] != "interactive_assistant":
        raise ValueError("Expected a version 1 interactive-assistant input bundle.")
    if bundle["source_hashes"] != {s["id"]: s["file_hash"] for s in records}:
        raise ValueError("Assisted input source hashes differ from the original source registry.")
    expected_ids = [s["id"] for s in plan["lessons"]]
    if [l["id"] for l in bundle["lessons"]] != expected_ids:
        raise ValueError("Assisted lesson IDs/order differ from the manifest.")
    pages = bundle["pages"]
    locations = [(p["source_id"], p["source_page"]) for p in pages]
    if len(locations) != len(set(locations)) or {p["source_id"] for p in pages} != set(plan["source_ids"]):
        raise ValueError("Source pages must be unique and cover exactly the selected source IDs.")
    for page in pages:
        if not isinstance(page["source_page"], int) or page["source_page"] < 1 or not page["text"].strip():
            raise ValueError("Invalid source page number or empty transcription.")
        if page["human_verified"] is not False:
            raise ValueError("Interactive AI transcription must not be labelled human-verified.")
        source = next(s for s in records if s["id"] == page["source_id"])
        if source["type"] == "image" and page["source_page"] != 1:
            raise ValueError("A source image has only one page.")
        for concept in page["concepts"]:
            if not normalized(concept["quote"]) or normalized(concept["quote"]) not in normalized(page["text"]):
                raise ValueError("An extracted concept quote is absent from its page.")
    stamp = datetime.now(timezone.utc)
    data = {"schema_version": "1.0", "run": {"run_id": stamp.strftime("psa-%Y%m%d-%H%M%S-assisted"),
            "model": bundle["model"], "prompt_version": bundle["prompt_version"], "generated_at": stamp.isoformat()},
            "disease": disease, "sources": [{**{k: s[k] for k in ("id", "title", "type", "file_hash")},
                                            "provided_by": plan["provided_by"]} for s in records],
            "topics": [topic], "lessons": [], "quizzes": [], "media": []}
    evaluations = []
    for item, spec in zip(bundle["lessons"], plan["lessons"], strict=True):
        lesson, quizzes = assemble(item["draft"], spec, plan)
        assessment = copy.deepcopy(item["assessment"])
        check_judge(assessment, lesson, quizzes, spec["concepts"])
        selected = [p for p in pages if p["source_id"] in spec["source_ids"]]
        scores, problems = evaluate(lesson, quizzes, selected, assessment)
        if problems:
            raise ValueError(f"{lesson['id']}: " + "; ".join(problems))
        evaluations.append({"lesson_id": lesson["id"], "judge": assessment, "readability": scores,
                            "problems": [], "assessment_method": "same interactive assistant; not independent"})
        data["lessons"].append(lesson)
        data["quizzes"].extend(quizzes)
    errors = validate_content(data, pages, topic)
    if errors:
        raise ValueError("Export validation failed: " + "; ".join(errors))
    return data, evaluations


def run(args):
    started = time.perf_counter()
    init_readability()
    plan, disease, topic = load_plan(args.manifest)
    chapter_folder, filename = chapter_output_names(disease, topic)
    args.out = args.out or ROOT / "data/psa/chapters" / chapter_folder
    records = source_records(plan)
    bundle = read_json(args.input)
    data, evaluations = assemble_bundle(bundle, plan, disease, topic, records)
    # Validate everything before creating a new export directory.
    if args.out.exists():
        raise ValueError("Output directory already exists; choose a new run directory.")
    args.out.mkdir(parents=True)
    audit = {"run_id": data["run"]["run_id"], "execution_mode": "interactive_assistant",
             "export_file": filename, "export_sha256": digest(data), "input_sha256": digest(bundle),
             "manifest": plan, "manifest_sha256": digest(plan), "source_records": records,
             "source_approval": "not_recorded", "clinical_review": "not_performed", "human_baseline": None,
             "lessons": evaluations,
             "wall_seconds": round(time.perf_counter() - started, 3), "wall_time_scope": "local assembly and validation only",
             "api_seconds": None, "api_calls": 0, "interactive_drafting_seconds": None,
             "correction_log": bundle["correction_log"], "models": [bundle["model"]],
             "authorship": bundle["authorship"], "python": platform.python_version(),
             "packages": {p: version(p) for p in ("textstat", "nltk", "httpx", "jsonschema", "pypdf", "PyYAML")}}
    write_json(args.out / filename, data)
    render_deliverables(args.out, data, audit)
    print(f"Validated export: {args.out / filename}")
    print(f"{len(data['lessons'])} interactive-AI draft lessons; no API calls or clinical approval.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=ROOT / "data/psa/assisted-input/symptoms.json")
    parser.add_argument("--manifest", type=Path, default=ROOT / "data/psa/week9-sample.yaml")
    parser.add_argument("--out", type=Path, help="Output directory; defaults to data/psa/chapters/<chapter-number>-<chapter-name>.")
    args = parser.parse_args()
    try:
        run(args)
    except Exception as error:
        print(f"ERROR: {type(error).__name__}: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

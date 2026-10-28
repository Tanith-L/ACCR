"""Generate source-grounded draft lessons and a reviewable Week 9 export."""
from __future__ import annotations

import argparse
import json
import platform
import sys
import time
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path
from jsonschema import ValidationError

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.content_processing import (
    ROOT, PROMPT_VERSION, DRAFT_SCHEMA, JUDGE_SCHEMA, ResponsesClient, assemble,
    chapter_output_names, check_judge, digest, evaluate, ingest, init_readability, load_plan, read_json,
    source_records, validate_content, write_json,
)


def render_deliverables(out, data, audit):
    """Write only readable lessons and the evaluation report."""
    interactive = audit.get("execution_mode") == "interactive_assistant"
    lesson_dir = out / "lessons"
    lesson_dir.mkdir(exist_ok=True)
    for lesson in data["lessons"]:
        lines = [f"# {lesson['title']}", "", "AI-generated draft. Not clinically reviewed or approved.", "",
                 f"Lesson ID: `{lesson['id']}` | Topic: `{lesson['topic_id']}` | About {lesson['est_minutes']} minute(s)", ""]
        for page in lesson["pages"]:
            lines += [f"## Page {page['order']}", "", page["body"], ""]
        lines += ["## Key takeaways", "", *[f"- {s}" for s in lesson["key_takeaways"]], "",
                  "## Check your understanding", ""]
        for q in (q for q in data["quizzes"] if q["lesson_id"] == lesson["id"]):
            lines += [q["question"], "", *[f"{n}. {s}" for n, s in enumerate(q["options"], 1)], "",
                      f"Answer: {q['answer'] + 1}. {q['feedback']}", ""]
        lines += ["## Source evidence (reviewer view)", ""]
        for claim in lesson["claims"]:
            lines += [f"- **{claim['id']}** (lesson page {claim['page']}): {claim['text']}",
                      f"  Source: `{claim['source_id']}`, source page {claim['source_page']}. Quote: {' '.join(claim['source_quote'].split())}"]
        (lesson_dir / f"{lesson['id']}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    evaluations = audit["lessons"]
    concepts = [c for result in evaluations for c in result["judge"]["coverage"]]
    covered = sum(c["covered"] for c in concepts)
    claims = sum(len(l["claims"]) for l in data["lessons"])
    unsupported = sum(l["checks"]["unsupported"] for l in data["lessons"])
    contradicted = sum(l["checks"]["contradicted"] for l in data["lessons"])
    method = ("Drafted and assessed by the same interactive assistant, then assembled and validated locally."
              if interactive else "Drafted and judged in separate API requests using the same model.")
    timing = ("Local Python assembly and validation only; interactive drafting was not timed."
              if interactive else "Includes extraction, API calls, checks and retries; excludes setup and human review.")
    request_time = ("Not measured; no successful generation API calls" if interactive else
                    f"{audit['api_seconds']:.3f} seconds across {audit['api_calls']} calls")
    corrections = (f"{len(audit['correction_log'])} recorded interactive content corrections" if interactive else
                   f"{sum(r['revision_count'] for r in evaluations)} automated revisions")
    report = ["# Week 9 content processing evaluation", "", f"Run: `{data['run']['run_id']}`", "", method, "",
              "Scope: one PsA topic, two draft lessons and six questions. Clinical approval is not recorded.", "",
              "| Dimension | Result | Interpretation |", "|---|---|---|",
              "| Schema validity | 100% of exported records valid | Existing backend schema and references validated |",
              f"| Source-faithfulness | {claims} claims; {unsupported} unsupported, {contradicted} contradicted | AI assessment against supplied sources, not independent clinical review |",
              f"| Traceability | All {claims} claims and {len(data['quizzes'])} quizzes have matching source quotes | Exact text matching plus assistant inspection of original images |",
              "| Structure | Zero broken relationships | Stable IDs, lesson membership and page order |",
              f"| Concept coverage proxy | {covered}/{len(concepts)} ({100*covered/len(concepts):.1f}%) | AI-editorial reference list fixed before drafting; not a human gold standard |",
              f"| Python processing time | {audit['wall_seconds']:.3f} seconds | {timing} |",
              f"| LLM request time | {request_time} | No manual-time saving is inferred |",
              f"| Correction effort | {corrections} | Human correction effort remains unmeasured |",
              "| Manual comparison | Not measured | Record manual structuring and AI-draft correction time using the same acceptance criteria |", "",
              "## Reading level", "",
              "Scores cover each lesson page, the takeaways and each quiz. The values below are maxima across those units; source quotations are reviewer evidence and are excluded. Titles are checked for length and plain language.", "",
              "| Lesson | Maximum FK | Maximum available SMOG | Status |", "|---|---:|---:|---|"]
    for lesson in data["lessons"]:
        report.append(f"| {lesson['id']} | {lesson['checks']['fk_grade']:.2f} | {lesson['checks']['smog']:.2f} | draft |")
    report += ["", "SMOG on 3-29 sentences is approximate; samples below 3 sentences are not scored. Formula scores do not prove comprehension or clinical safety.", "",
               "## Concept coverage", "", "| Lesson | Concept | Covered | Evidence or gap |", "|---|---|---|---|"]
    for result in evaluations:
        for concept in result["judge"]["coverage"]:
            evidence = ", ".join(concept["claim_ids"]) + ": " + concept["reason"]
            report.append(f"| {result['lesson_id']} | {concept['id']} | {'yes' if concept['covered'] else 'partial/missing'} | {evidence} |")
    report += ["", "## Provenance and remaining review", "",
               f"- Model provenance: {', '.join(audit['models'])}",
               f"- Prompt version: {data['run']['prompt_version']}",
               f"- Python: {audit['python']}; packages: {json.dumps(audit['packages'])}",
               ("- Source transcriptions, drafted text and individual assessments are maintained in data/psa/assisted-input/symptoms.json. This run does not claim independent judge calls."
                if interactive else "- Source transcriptions and API call evidence are consolidated in evidence.json."),
               "- Source IDs, original file hashes and exact quotes are preserved. For an image, source page 1 means that single original image.",
               "- Human concept identification, source approval, clinical Rubric B scores, judge calibration and manual timing are still pending. Backend checks.coverage remains null until a human reference set exists.",
               "- For a manual comparison, separately record editor, task, active minutes and correction count for manual structuring and AI-draft correction.",
               "- Original sources may contain errors; matching them is not independent evidence of current clinical accuracy.",
               "- The sample does not establish a disease-progression timeline. No reviewed/published status or database write is performed.", "",
               "## Validation and demonstration", "",
               f"Validate: python pipeline/validate_content.py {out.as_posix()}",
               f"Backend dry run: python backend/scripts/import_content.py {out.as_posix()}/{audit['export_file']} --dry-run --media-dir {out.as_posix()}",
               "",
               "For the client demonstration, open an original poster beside the corresponding lesson Markdown. Follow a claim to its quote and then show the results above.", ""]
    (out / "eval_report.md").write_text("\n".join(report), encoding="utf-8")


def run(args):
    started = time.perf_counter()
    init_readability()
    plan, disease, topic = load_plan(args.manifest)
    chapter_folder, filename = chapter_output_names(disease, topic)
    args.out = args.out or ROOT / "data/psa/chapters" / chapter_folder
    records = source_records(plan)
    if args.out.exists():
        raise ValueError("Output directory already exists. Choose a new directory to preserve prior evidence.")
    args.out.mkdir(parents=True)
    client = ResponsesClient(args.model, args.out, args.temperature)
    if args.reuse_sources:
        cache = read_json(args.reuse_sources)["sources"]
        if cache["source_hashes"] != {s["id"]: s["file_hash"] for s in records}:
            raise ValueError("Cached extraction does not match the selected source bytes.")
        pages = cache["pages"]
        images = [(s["id"], 1, ROOT / s["local_file"]) for s in records if s["type"] == "image"]
    else:
        pages, images = ingest(records, client)
    sources = {"source_hashes": {s["id"]: s["file_hash"] for s in records}, "pages": pages}
    stamp = datetime.now(timezone.utc)
    run_id = stamp.strftime("psa-%Y%m%d-%H%M%S")
    data = {"schema_version": "1.0", "run": {"run_id": run_id, "model": args.model,
            "prompt_version": PROMPT_VERSION, "generated_at": stamp.isoformat()}, "disease": disease,
            "sources": [{**{k: s[k] for k in ("id", "title", "type", "file_hash")},
                         "provided_by": plan["provided_by"]} for s in records],
            "topics": [topic], "lessons": [], "quizzes": [], "media": []}
    evaluations = []
    for spec in plan["lessons"]:
        selected = [p for p in pages if p["source_id"] in spec["source_ids"]]
        evidence_images = [i for i in images if i[0] in spec["source_ids"]]
        feedback, attempts = [], []
        for revision in range(3):
            payload = {"lesson": spec, "source_pages": selected, "revision_feedback": feedback}
            if attempts:
                payload["previous_draft"] = attempts[-1]["draft"]
            for schema_attempt in range(2):
                draft = client.call(f"draft-{spec['id']}-r{revision}-s{schema_attempt}", "draft", payload, DRAFT_SCHEMA)
                try:
                    lesson, quizzes = assemble(draft, spec, plan)
                    break
                except (ValueError, KeyError, IndexError, ValidationError) as error:
                    if schema_attempt:
                        raise
                    payload["validation_error"] = str(error)
            judge = client.call(f"judge-{spec['id']}-r{revision}", "judge",
                                {"lesson": lesson, "quizzes": quizzes, "source_pages": selected,
                                 "reference_concepts": spec["concepts"]}, JUDGE_SCHEMA, evidence_images)
            check_judge(judge, lesson, quizzes, spec["concepts"])
            scores, feedback = evaluate(lesson, quizzes, selected, judge)
            # Coverage is reported, not a pass gate (pipeline design, section 3).
            attempts.append({"draft": draft, "judge": judge, "readability": scores, "problems": feedback})
            if not feedback:
                break
        if feedback:
            raise ValueError(f"{spec['id']} needs manual revision after two retries. See evidence.json. No importable export written.")
        evaluations.append({"lesson_id": spec["id"], "revision_count": revision, "judge": judge,
                            "readability": scores, "problems": feedback})
        data["lessons"].append(lesson)
        data["quizzes"].extend(quizzes)
    data["run"]["model"] = next(c["model"] for c in client.calls if c["stage"].startswith("draft-"))
    errors = validate_content(data, pages, topic)
    if errors:
        raise ValueError("Export validation failed: " + "; ".join(errors))
    audit = {"run_id": run_id, "execution_mode": "api", "export_file": filename, "export_sha256": digest(data),
             "manifest": plan, "manifest_sha256": digest(plan), "source_records": records,
             "source_approval": "not_recorded", "clinical_review": "not_performed", "human_baseline": None,
             "sources_sha256": digest(sources),
             "calls_sha256": digest(client.calls), "lessons": evaluations,
             "wall_seconds": round(time.perf_counter() - started, 3),
             "api_seconds": round(sum(c["seconds"] for c in client.calls), 3), "api_calls": len(client.calls),
             "models": sorted({c["model"] for c in client.calls}), "python": platform.python_version(),
             "packages": {p: version(p) for p in ("textstat", "nltk", "httpx", "jsonschema", "pypdf", "PyYAML")}}
    write_json(args.out / filename, data)
    write_json(args.out / "evidence.json", {"export_sha256": digest(data), "manifest": plan,
                                          "sources": sources, "calls": client.calls})
    render_deliverables(args.out, data, audit)
    print(f"Validated export: {args.out / filename}\n{len(data['lessons'])} draft lessons; clinical review pending.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=ROOT / "data/psa/week9-sample.yaml")
    parser.add_argument("--out", type=Path, help="Output directory; defaults to data/psa/chapters/<chapter-number>-<chapter-name>.")
    parser.add_argument("--model", default="gpt-5.4-mini")
    parser.add_argument("--temperature", type=float, default=None, help="Use 0 for models supporting temperature; omit otherwise.")
    parser.add_argument("--reuse-sources", type=Path, help="Reuse source pages from a prior evidence.json after verifying original hashes.")
    args = parser.parse_args()
    try:
        run(args)
    except Exception as error:
        print(f"ERROR: {type(error).__name__}: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Week 9 data evaluation: validity, traceability, structure, accuracy, coverage, efficiency.

    python -m rheumnotes_data evaluate data/output/psa_overview.json \
        --manual-concepts data/eval/manual_concepts.yaml --manual-minutes 90

Writes a Markdown report next to the bundle. Coverage needs the trace file
from `run`; accuracy here is the automatic claim verifier, and the human
review sample is recorded in data/eval/accuracy_review.csv.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

from .validate import validate_bundle

_WORD = re.compile(r"[a-z0-9]+")
_STOP = {"the", "a", "an", "of", "and", "or", "in", "to", "is", "for", "with", "psa"}


def _tokens(text: str) -> set[str]:
    return {w for w in _WORD.findall(text.lower()) if w not in _STOP}


def coverage(manual: list[str], extracted: list[str], threshold: float = 0.5) -> tuple[float, list[str]]:
    """Share of manually identified concepts matched by an extracted one (token overlap).
    Returns (ratio, missed). Spot-check matches by hand; overlap is a rough proxy."""
    missed = []
    for m in manual:
        mt = _tokens(m)
        if not any(len(mt & _tokens(e)) / max(1, len(mt)) >= threshold for e in extracted):
            missed.append(m)
    return (1 - len(missed) / len(manual)) if manual else 0.0, missed


def evaluate(bundle_path: Path, manual_concepts: Path | None = None,
             manual_minutes: float | None = None) -> str:
    bundle = json.loads(bundle_path.read_text())
    report = validate_bundle(bundle)
    lessons = bundle["lessons"]
    claims = [c for l in lessons for c in l["claims"]]
    supported = sum(1 for c in claims if c["supported"] is True)
    traceable = sum(1 for l in lessons if l["source_refs"])
    run = bundle["pipeline_run"]

    rows = [
        ("Schema validity", f"{'100%' if not report.schema_errors else 'FAIL'} "
                            f"({len(report.schema_errors)} schema errors)", "100% valid"),
        ("Source traceability", f"{traceable}/{len(lessons)} lessons cite a source", "100%"),
        ("Structural consistency", f"{len(report.structure_errors)} broken relationships", "0"),
        ("Information accuracy (auto)", f"{supported}/{len(claims)} claims supported by verifier",
         "no unsupported claims in reviewed sample"),
        ("Status", f"{sum(l['status'] == 'checked' for l in lessons)} checked / "
                   f"{sum(l['status'] == 'draft' for l in lessons)} draft", "-"),
    ]

    missed: list[str] = []
    trace_path = bundle_path.with_suffix(".trace.json")
    if manual_concepts and trace_path.exists():
        manual = yaml.safe_load(manual_concepts.read_text())["concepts"]
        extracted = [c["name"] + " " + c["explanation"] for c in json.loads(trace_path.read_text())["concepts"]]
        ratio, missed = coverage(manual, extracted)
        rows.append(("Content coverage", f"{ratio:.0%} of {len(manual)} manual concepts", "report %"))
    else:
        rows.append(("Content coverage", "not measured (needs --manual-concepts and a .trace.json)", "report %"))

    usage = run.get("usage") or {}
    eff = f"{run.get('duration_seconds') or 0:.0f}s AI run"
    if usage:
        eff += f", {usage.get('input_tokens', 0)} in / {usage.get('output_tokens', 0)} out tokens"
    if manual_minutes:
        eff += f" vs {manual_minutes:.0f} min manual structuring"
    rows.append(("AI efficiency", eff + " (add correction time from the review sheet)", "report time & corrections"))

    out = [f"# Data evaluation: {bundle_path.name}", "",
           f"Run `{run['run_id']}` ({run['mode']}, model {run.get('model') or '-'}, "
           f"prompts {run.get('prompt_version') or '-'})", "",
           "| Dimension | Result | Week 9 target |", "|---|---|---|"]
    out += [f"| {d} | {r} | {t} |" for d, r, t in rows]
    if report.schema_errors or report.structure_errors:
        out += ["", "## Validation problems", "", "```", report.summary(), "```"]
    unsupported = [(l["id"], c["text"]) for l in lessons for c in l["claims"] if c["supported"] is not True]
    if unsupported:
        out += ["", "## Claims needing attention", ""] + [f"- `{lid}`: {t}" for lid, t in unsupported]
    if missed:
        out += ["", "## Manual concepts not found by extraction", ""] + [f"- {m}" for m in missed]
    return "\n".join(out) + "\n"

"""CLI: python -m rheumnotes_data <command>

  convert-legacy   topics.yaml + lessons/*.md -> data/output/psa_legacy.json
  run              source documents -> AI lessons for one topic
  validate         check a bundle against the schema and structural rules
  evaluate         write the Week 9 evaluation report for a bundle
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .paths import OUTPUT_DIR


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="rheumnotes_data")
    sub = p.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("convert-legacy", help="convert the hand-written repo content")
    c.add_argument("-o", "--out", type=Path, default=OUTPUT_DIR / "psa_legacy.json")

    r = sub.add_parser("run", help="run the AI pipeline")
    r.add_argument("sources", nargs="+", type=Path)
    r.add_argument("--topic", required=True, help="topic id from topics.yaml, e.g. overview")
    r.add_argument("--max-lessons", type=int, default=3)
    r.add_argument("--model", default=None)
    r.add_argument("-o", "--out", type=Path, default=None)

    v = sub.add_parser("validate", help="validate a bundle")
    v.add_argument("bundle", type=Path)

    e = sub.add_parser("evaluate", help="write an evaluation report")
    e.add_argument("bundle", type=Path)
    e.add_argument("--manual-concepts", type=Path)
    e.add_argument("--manual-minutes", type=float)

    args = p.parse_args(argv)

    if args.cmd == "convert-legacy":
        from .legacy import convert
        from .pipeline import write_bundle
        bundle = convert()
        return _finish(bundle, args.out, write_bundle)

    if args.cmd == "run":
        from .generator import DEFAULT_MODEL, ClaudeGenerator
        from .ingest import load_documents
        from .pipeline import run, write_bundle
        out = args.out or OUTPUT_DIR / f"psa_{args.topic}.json"
        previous = json.loads(out.read_text()) if out.exists() else None
        bundle, trace = run(load_documents(args.sources), ClaudeGenerator(args.model or DEFAULT_MODEL),
                            args.topic, max_lessons=args.max_lessons, previous=previous)
        return _finish(bundle, out, write_bundle, trace)

    if args.cmd == "validate":
        from .validate import validate_file
        report = validate_file(args.bundle)
        print(report.summary())
        return 0 if report.ok else 1

    if args.cmd == "evaluate":
        from .evaluate import evaluate
        md = evaluate(args.bundle, args.manual_concepts, args.manual_minutes)
        out = args.bundle.with_suffix(".eval.md")
        out.write_text(md)
        print(md)
        print(f"wrote {out}")
        return 0
    return 2


def _finish(bundle: dict, out: Path, write_bundle, trace: dict | None = None) -> int:
    from .validate import validate_bundle
    report = validate_bundle(bundle)
    write_bundle(bundle, out, trace)
    statuses = [l["status"] for l in bundle["lessons"]]
    print(f"wrote {out}: {len(bundle['topics'])} topic(s), {len(statuses)} lesson(s) "
          f"({statuses.count('checked')} checked, {statuses.count('draft')} draft)")
    print(report.summary())
    return 0 if report.ok else 1


if __name__ == "__main__":
    sys.exit(main())

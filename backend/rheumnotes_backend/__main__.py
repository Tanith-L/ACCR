"""CLI: python -m rheumnotes_backend <command>

  import BUNDLE [--dry-run]   validate + import a Data-pipeline bundle
  review-sheet                write a CSV of all checked lessons for Dr. Murphy
  review-import SHEET         apply a scored review sheet
  publish [LESSON_ID ...]     reviewed -> published (all reviewed if no ids)
  evaluate BUNDLE             Week 9 backend evaluation report
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

REVIEW_DIR = Path(__file__).resolve().parents[1] / "review_sheets"


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    p = argparse.ArgumentParser(prog="rheumnotes_backend")
    sub = p.add_subparsers(dest="cmd", required=True)
    i = sub.add_parser("import")
    i.add_argument("bundle", type=Path)
    i.add_argument("--dry-run", action="store_true", help="validate and map, don't touch the database")
    sub.add_parser("review-sheet")
    r = sub.add_parser("review-import")
    r.add_argument("sheet", type=Path)
    pub = sub.add_parser("publish")
    pub.add_argument("lesson_ids", nargs="*")
    e = sub.add_parser("evaluate")
    e.add_argument("bundle", type=Path)
    args = p.parse_args(argv)

    if args.cmd == "import":
        from .importer import ImportErrorReport, import_bundle
        try:
            print(json.dumps(import_bundle(args.bundle, dry_run=args.dry_run)))
        except ImportErrorReport as err:
            print(f"bundle rejected:\n{err}", file=sys.stderr)
            return 1
    elif args.cmd == "review-sheet":
        from .review import export_review_sheet
        print(f"wrote {export_review_sheet(REVIEW_DIR)}")
    elif args.cmd == "review-import":
        from .review import import_review_sheet
        print(json.dumps(import_review_sheet(args.sheet)))
    elif args.cmd == "publish":
        from .review import publish
        print(json.dumps(publish(args.lesson_ids or None)))
    elif args.cmd == "evaluate":
        from .evaluate import evaluate
        print(evaluate(args.bundle))
    return 0


if __name__ == "__main__":
    sys.exit(main())

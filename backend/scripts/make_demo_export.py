"""Build the demo export from fixtures/mock_export.json with IDs of its own.

    python backend/scripts/make_demo_export.py [--out backend/exports/export_psa_demo.json]

The mock fixture reuses IDs of real lessons (psa-dx-01, topic dx), so importing it as-is
into a project that holds real content would overwrite real drafts. This copy uses
psa-demo-*, demo-*, a free topic order, and says on its face that the content is invented
for the demo. Import it with import_content.py like any other export.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
MOCK = BACKEND / "fixtures" / "mock_export.json"
DEFAULT_OUT = BACKEND / "exports" / "export_psa_demo.json"
DEMO_TOPIC_ORDER = 7  # real topics use 1-6

# Replaced in order, as plain text over the serialized JSON.
RENAMES = [
    ("psa-dx-", "psa-demo-"),
    ('"dx-criteria"', '"demo-criteria"'),
    ('"dx-imaging"', '"demo-imaging"'),
    ('"dx"', '"demo"'),
    ("src-mock-onepager", "src-demo-onepager"),
    ('"mock-joints"', '"demo-joints"'),
    ("Mock PsA One-Pager (test fixture)", "Demo PsA One-Pager (invented content for the demo)"),
    ('"Understanding diagnosis"', '"Demo: diagnosis basics"'),
    ('"2026-10-28-mock"', '"demo-2026-10-28"'),
]


def build_demo(mock_path: Path = MOCK) -> dict:
    text = mock_path.read_text(encoding="utf-8")
    for old, new in RENAMES:
        if old not in text:
            raise ValueError(f"expected {old!r} in {mock_path}; the fixture changed, update RENAMES")
        text = text.replace(old, new)
    data = json.loads(text)
    data["topics"][0]["order"] = DEMO_TOPIC_ORDER
    return data


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args(argv)
    try:
        data = build_demo()
    except (OSError, ValueError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {args.out}: {len(data['lessons'])} lessons "
          f"({', '.join(l['id'] for l in data['lessons'])}); images are read from {MOCK.parent}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

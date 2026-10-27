"""Offline: bundle -> rows mapping matches the SQL migration's columns."""
import json
import re
from pathlib import Path

from rheumnotes_backend.importer import bundle_to_rows
from rheumnotes_data.legacy import convert

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = sorted((ROOT / "backend" / "supabase" / "migrations").glob("*.sql"))
FIXTURE = ROOT / "shared" / "fixtures" / "test_bundle.json"


def table_columns() -> dict[str, set[str]]:
    sql = "\n".join(p.read_text() for p in MIGRATIONS)
    tables = {}
    for name, body in re.findall(r"create table (\w+) \((.*?)\n\);", sql, re.S):
        cols = {line.split()[0] for line in body.splitlines()
                if line.strip() and not line.strip().startswith("--")
                and line.split()[0] not in ("unique", "primary", "check")}
        tables[name] = cols
    return tables


def test_rows_only_use_existing_columns():
    columns = table_columns()
    for bundle in (json.loads(FIXTURE.read_text()), convert()):
        for table, rows in bundle_to_rows(bundle).items():
            assert table in columns, table
            for row in rows:
                unknown = set(row) - columns[table]
                assert not unknown, f"{table}: {unknown}"


def test_fixture_maps_both_statuses():
    rows = bundle_to_rows(json.loads(FIXTURE.read_text()))
    assert {r["status"] for r in rows["lesson_versions"]} == {"checked", "draft"}
    assert all(r["run_id"] == "fixture-1" for r in rows["lesson_versions"])

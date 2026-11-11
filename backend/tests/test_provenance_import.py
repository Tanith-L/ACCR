"""Offline importer checks using actual JSONB adapters and recorded SQL."""
from contextlib import nullcontext
import json
from pathlib import Path
import unittest
from unittest.mock import patch

import import_content as importer

ROOT = Path(__file__).resolve().parents[2]


class RecordingConnection:
    """Record actual importer SQL/parameters without connecting to a database."""
    def __init__(self, migrated=True):
        self.migrated = migrated
        self.writes = []

    def transaction(self):
        return nullcontext()

    def execute(self, sql, params=()):
        self.writes.append((sql, params))
        return self

    def fetchone(self):
        return (1,) if self.migrated else None


class ProvenanceImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / "data/psa/chapter/psa-content.json").read_text(encoding="utf-8"))

    def test_import_preserves_provenance_and_reports_it_separately(self):
        plan = importer.plan_lessons(self.data, {})
        report = importer.build_report(self.data, plan)
        self.assertEqual((0, 24), (report["claims"], report["provenance"]))
        conn = RecordingConnection()
        with patch.object(importer, "unique_run_id", return_value="test-provenance"):
            importer.write_import(conn, self.data, plan, "test.json")
        writes = [params for sql, params in conn.writes if sql.startswith("update lessons set provenance=")]
        self.assertEqual(24, len(writes))
        for lesson, (jsonb, lesson_id, version) in zip(self.data["lessons"], writes, strict=True):
            self.assertEqual((lesson["id"], 1), (lesson_id, version))
            self.assertEqual(lesson["claims"], jsonb.obj)
        self.assertFalse(any(sql.startswith("insert into lesson_claims") for sql, _ in conn.writes))

    def test_missing_migration_fails_before_database_writes(self):
        conn = RecordingConnection(migrated=False)
        with self.assertRaisesRegex(importer.ImportRejected, "0008"):
            importer.write_import(conn, self.data, importer.plan_lessons(self.data, {}), "test.json")
        self.assertFalse(any(sql.startswith(("insert ", "update ", "delete ")) for sql, _ in conn.writes))

    def test_legacy_import_keeps_assertions_and_clears_stale_provenance(self):
        legacy = json.loads((ROOT / "backend/fixtures/mock_export.json").read_text(encoding="utf-8"))
        for migrated in (False, True):
            conn = RecordingConnection(migrated=migrated)
            with patch.object(importer, "unique_run_id", return_value="legacy"):
                importer.write_import(conn, legacy, importer.plan_lessons(legacy, {}), "legacy.json")
            assertions = [p for sql, p in conn.writes if sql.startswith("insert into lesson_claims")]
            self.assertEqual(9, len(assertions))
            provenance = [p for sql, p in conn.writes if sql.startswith("update lessons set provenance=")]
            self.assertEqual(3 if migrated else 0, len(provenance))
            self.assertTrue(all(p[0].obj == [] for p in provenance))


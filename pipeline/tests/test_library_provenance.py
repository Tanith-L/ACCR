"""Current-library evidence survives export/import without becoming verified claims."""
import copy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend/scripts"))
from convert_repo_content import validate_export
import import_content as importer
from pipeline.build_psa_library import build


class LibraryProvenanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data, cls.authored, _ = build()
        cls.schema = json.loads((ROOT / "schema/content.schema.json").read_text(encoding="utf-8"))

    def test_all_current_evidence_is_exported_losslessly(self):
        self.assertEqual("1.3", self.data["schema_version"])
        self.assertEqual(24, len(self.data["lessons"]))
        for lesson, draft in zip(self.data["lessons"], self.authored["lessons"], strict=True):
            record, = lesson["claims"]
            self.assertEqual("provenance", record["kind"])
            self.assertEqual(draft["source_usage"], record["source_usage"])
            self.assertEqual([{"id": rid, **self.authored["references"][rid]} for rid in draft["references"]],
                             record["references"])
            self.assertEqual("checked", lesson["status"])
            self.assertEqual(([], "checked"), (lesson["checks"]["safety_flags"], importer.effective_status(lesson)[0]))
            self.assertFalse({"source_quote", "source_page", "support", "quote_match"} & record.keys())
        self.assertEqual([], validate_export(self.data, self.schema))

    def test_broken_source_ids_and_lesson_pages_are_rejected(self):
        data = copy.deepcopy(self.data)
        usage = data["lessons"][0]["claims"][0]["source_usage"][0]
        usage.update(source_id="src-missing", pages=[999])
        errors = validate_export(data, self.schema)
        self.assertTrue(any("unknown source_id" in e for e in errors))
        self.assertTrue(any("lesson page out of range" in e for e in errors))

    def test_empty_reference_list_is_allowed_but_bad_url_is_not(self):
        data = copy.deepcopy(self.data)
        record = data["lessons"][0]["claims"][0]
        record["references"] = []
        self.assertEqual([], validate_export(data, self.schema))
        record["references"] = [{"id": "bad-ref", "title": "Bad", "url": "not-a-url"}]
        self.assertTrue(validate_export(data, self.schema))

    def test_provenance_requires_schema_13(self):
        for version in ("1.0", "1.1", "1.2"):
            data = copy.deepcopy(self.data)
            data["schema_version"] = version
            self.assertTrue(validate_export(data, self.schema), version)

    def test_provenance_lesson_needs_traceability_and_clean_flags_for_checked(self):
        lesson = copy.deepcopy(self.data["lessons"][0])
        self.assertEqual(("checked", []), importer.effective_status(lesson))
        flagged = copy.deepcopy(lesson)
        flagged["checks"]["safety_flags"] = ["review needed"]
        self.assertEqual("draft", importer.effective_status(flagged)[0])
        untraced = copy.deepcopy(lesson)
        untraced["claims"][0]["source_usage"] = []
        status, failures = importer.effective_status(untraced)
        self.assertEqual("draft", status)
        self.assertTrue(any("without a named source" in f for f in failures))

    def test_reference_edit_is_an_evidence_only_update(self):
        original = self.data["lessons"][0]
        changed = copy.deepcopy(original)
        changed["claims"][0]["references"][0]["url"] += "#updated"
        content_hash = importer.content_hash(original, [])
        evidence_hash = importer.evidence_hash(original, "checked")
        self.assertEqual(content_hash, importer.content_hash(changed, []))
        new_hash = importer.evidence_hash(changed, "checked")
        self.assertNotEqual(evidence_hash, new_hash)
        self.assertEqual(("update", 1), importer.decide(
            {"version": 1, "status": "checked", "content_hash": content_hash, "evidence_hash": evidence_hash},
            content_hash, new_hash))



if __name__ == "__main__":
    unittest.main()

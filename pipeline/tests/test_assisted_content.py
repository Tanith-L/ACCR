"""Assisted-input validation must preserve provenance and reject bad evidence."""
import copy
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path

from pipeline.assemble_assisted_content import assemble_bundle
from pipeline.content_processing import ROOT, init_readability, load_plan, read_json


class AssistedContentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_readability()
        cls.bundle = read_json(ROOT / "data/psa/assisted-input/symptoms.json")
        cls.plan, cls.disease, cls.topic = load_plan(ROOT / "data/psa/week9-sample.yaml")
        registry = read_json(ROOT / "data/psa/source-inventory.json")
        cls.records = [s for s in registry if s["id"] in cls.plan["source_ids"]]

    def export(self, bundle):
        return assemble_bundle(bundle, self.plan, self.disease, self.topic, self.records)

    def test_real_assisted_sample_is_valid_and_reports_partial_coverage(self):
        data, evaluations = self.export(self.bundle)
        self.assertEqual(2, len(data["lessons"]))
        self.assertEqual(6, len(data["quizzes"]))
        self.assertTrue(all(l["status"] == "draft" for l in data["lessons"]))
        self.assertTrue(all(l["checks"]["coverage"] is None for l in data["lessons"]))
        concepts = [c for e in evaluations for c in e["judge"]["coverage"]]
        self.assertEqual(11, sum(c["covered"] for c in concepts))
        self.assertEqual(12, len(concepts))

    def test_changed_original_hash_is_rejected(self):
        bundle = copy.deepcopy(self.bundle)
        bundle["source_hashes"][next(iter(bundle["source_hashes"]))] = "0" * 64
        with self.assertRaisesRegex(ValueError, "hashes differ"):
            self.export(bundle)

    def test_missing_assessment_cannot_be_silently_filled(self):
        bundle = copy.deepcopy(self.bundle)
        bundle["lessons"][0]["assessment"]["claims"].pop()
        with self.assertRaisesRegex(ValueError, "exactly one result"):
            self.export(bundle)

    def test_unsupported_assessment_stops_export(self):
        bundle = copy.deepcopy(self.bundle)
        # This claim is not used by the concept coverage mapping.
        bundle["lessons"][0]["assessment"]["claims"][0]["support"] = "unsupported"
        with self.assertRaisesRegex(ValueError, "unsupported"):
            self.export(bundle)

    def test_duplicate_source_pages_are_rejected(self):
        bundle = copy.deepcopy(self.bundle)
        bundle["pages"].append(copy.deepcopy(bundle["pages"][0]))
        with self.assertRaisesRegex(ValueError, "unique"):
            self.export(bundle)

    def test_ai_source_cannot_claim_human_verification(self):
        bundle = copy.deepcopy(self.bundle)
        bundle["pages"][0]["human_verified"] = True
        with self.assertRaisesRegex(ValueError, "human-verified"):
            self.export(bundle)

    def test_core_run_revalidates_without_snapshots_and_detects_edits(self):
        from pipeline.assemble_assisted_content import run
        from pipeline.content_processing import write_json
        from pipeline.validate_content import validate_run
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / "run"
            run(Namespace(input=ROOT / "data/psa/assisted-input/symptoms.json",
                          manifest=ROOT / "data/psa/week9-sample.yaml", out=out))
            files = [p for p in out.rglob("*") if p.is_file()]
            self.assertEqual(4, len(files))
            self.assertEqual([], validate_run(out))
            export_path = out / "psa-symptoms-and-disease-progression.json"
            exported = read_json(export_path)
            exported["lessons"][0]["checks"]["fk_grade"] = 0
            write_json(export_path, exported)
            self.assertTrue(any("differs from the current assisted input" in e for e in validate_run(out)))


if __name__ == "__main__":
    unittest.main()

"""Offline regression tests for evidence failures; no API calls or database access."""
import copy
import json
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch

from pipeline.content_processing import (
    DRAFT_SCHEMA, EXTRACT_SCHEMA, ResponsesClient, assemble, check_judge, digest,
    evaluate, ingest, init_readability, literal_numbers_ok, load_plan,
    quote_matches, readability, validate_content,
)


def fixture():
    text = "Joints can swell. Skin can have scales. Nails can have pits."
    sentences = [s + "." for s in text.rstrip(".").split(". ")]
    cite = {"source_id": "src-test", "source_page": 1, "source_quote": text}
    plan = {"topic_id": "symptoms", "subtopic_id": "symptoms-domains"}
    spec = {"id": "psa-symptoms-01", "source_ids": ["src-test"], "concepts": [{"id": "joints"}]}
    quiz = {"question": "What can happen to joints?", "options": ["They can swell.", "They grow scales."],
            "answer": 0, "feedback": "Joints can swell.", **cite}
    draft = {"title": "Changes you may notice", "pages": [{"sentences": [{"text": s, **cite} for s in sentences]}],
             "key_takeaway_indices": [1, 2], "quizzes": [copy.deepcopy(quiz) for _ in range(3)]}
    lesson, quizzes = assemble(draft, spec, plan)
    pages = [{"source_id": "src-test", "source_page": 1, "text": text, "uncertain_regions": []}]
    verdict = lambda r: {"id": r["id"], "support": "supported", "source_quote_verified": True,
                         "numbers_ok": True, "reason": "Synthetic fixture support."}
    judge = {"claims": [verdict(c) for c in lesson["claims"]], "quizzes": [verdict(q) for q in quizzes],
             "coverage": [{"id": "joints", "covered": True, "claim_ids": [lesson["claims"][0]["id"]], "reason": "Explicit."}],
             "safety_flags": [], "plain_language_flags": [], "title_supported": True}
    evaluate(lesson, quizzes, pages, judge)
    data = {"schema_version": "1.0", "run": {"run_id": "test", "model": "test-fixture-not-llm",
            "prompt_version": "test", "generated_at": "2026-10-28T00:00:00Z"},
            "disease": {"id": "psa", "name": "Psoriatic arthritis"},
            "sources": [{"id": "src-test", "title": "Synthetic source", "type": "image", "provided_by": "Test", "file_hash": "a" * 64}],
            "topics": [{"id": "symptoms", "name": "Symptoms", "order": 3,
                        "subtopics": [{"id": "symptoms-domains", "name": "Where PsA appears", "order": 1,
                                       "lesson_ids": [lesson["id"]]}]}],
            "lessons": [lesson], "quizzes": quizzes, "media": []}
    return draft, spec, plan, lesson, quizzes, pages, judge, data


class EvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_readability()

    def test_fixture_passes_contract(self):
        *_, pages, judge, data = fixture()
        self.assertEqual([], validate_content(data, pages))

    def test_wrong_page_cannot_match_quote(self):
        *_, lesson, quizzes, pages, judge, data = fixture()
        item = copy.deepcopy(lesson["claims"][0])
        item["source_page"] = 2
        self.assertFalse(quote_matches(item, pages))

    def test_quote_match_normalizes_only_whitespace(self):
        *_, lesson, quizzes, pages, judge, data = fixture()
        item = copy.deepcopy(lesson["claims"][0])
        item["source_quote"] = "Joints\n can  swell."
        self.assertTrue(quote_matches(item, pages))
        item["source_quote"] = "Joints cannot swell."
        self.assertFalse(quote_matches(item, pages))

    def test_added_uncited_sentence_is_rejected(self):
        *_, pages, judge, data = fixture()
        data["lessons"][0]["pages"][0]["body"] += " This cures arthritis."
        self.assertTrue(any("uncited" in e for e in validate_content(data, pages)))

    def test_unsupported_summary_is_rejected(self):
        *_, pages, judge, data = fixture()
        data["lessons"][0]["key_takeaways"][0] = "All symptoms stop."
        self.assertTrue(any("takeaway" in e for e in validate_content(data, pages)))

    def test_zero_takeaway_index_is_rejected(self):
        draft, spec, plan, *_ = fixture()
        draft["key_takeaway_indices"] = [0]
        with self.assertRaises(ValueError):
            assemble(draft, spec, plan)

    def test_broken_relationship_is_rejected(self):
        *_, pages, judge, data = fixture()
        data["topics"][0]["subtopics"][0]["lesson_ids"] = ["missing"]
        self.assertTrue(validate_content(data, pages))

    def test_published_status_is_rejected(self):
        *_, pages, judge, data = fixture()
        data["lessons"][0]["status"] = "published"
        self.assertTrue(validate_content(data, pages))

    def test_duplicate_or_missing_judge_ids_are_rejected(self):
        _, spec, _, lesson, quizzes, _, judge, _ = fixture()
        judge["claims"][1] = judge["claims"][0]
        with self.assertRaises(ValueError):
            check_judge(judge, lesson, quizzes, spec["concepts"])

    def test_exact_quote_does_not_override_unsupported_verdict(self):
        _, _, _, lesson, quizzes, pages, judge, _ = fixture()
        judge["claims"][0]["support"] = "unsupported"
        _, problems = evaluate(lesson, quizzes, pages, judge)
        self.assertEqual(1, lesson["checks"]["unsupported"])
        self.assertTrue(problems)

    def test_wrong_image_quote_fails_even_if_transcript_matches(self):
        _, _, _, lesson, quizzes, pages, judge, _ = fixture()
        judge["claims"][0]["source_quote_verified"] = False
        _, problems = evaluate(lesson, quizzes, pages, judge)
        self.assertLess(lesson["checks"]["citation_accuracy"], 1)
        self.assertTrue(problems)

    def test_unsafe_quiz_fails_lesson(self):
        _, _, _, lesson, quizzes, pages, judge, _ = fixture()
        judge["quizzes"][0]["support"] = "unsupported"
        _, problems = evaluate(lesson, quizzes, pages, judge)
        self.assertTrue(any(quizzes[0]["id"] in p for p in problems))

    def test_numbers_are_matched_as_tokens(self):
        self.assertFalse(literal_numbers_ok("Use 5 mg.", "Use 15 mg."))
        self.assertTrue(literal_numbers_ok("About 15%.", "About 15%."))

    def test_short_smog_is_missing_not_zero(self):
        _, _, _, lesson, quizzes, *_ = fixture()
        lesson["key_takeaways"] = ["Joints can swell."]
        score = next(s for s in readability(lesson, quizzes) if s["unit"] == "takeaways")
        self.assertIsNone(score["smog"])

    def test_coverage_needs_supported_claim_evidence(self):
        _, spec, _, lesson, quizzes, _, judge, _ = fixture()
        judge["coverage"][0]["claim_ids"] = ["invented-c1"]
        with self.assertRaises(ValueError):
            check_judge(judge, lesson, quizzes, spec["concepts"])

    def test_docx_has_no_invented_page_numbers(self):
        source = {"id": "src-docx", "type": "docx", "local_file": "unused.docx"}
        with self.assertRaisesRegex(ValueError, "paragraph numbers are not pages"):
            ingest([source], None)

    def test_api_refusal_never_becomes_lesson_data(self):
        import httpx
        response = httpx.Response(200, json={"status": "completed", "output": [
            {"type": "message", "content": [{"type": "refusal", "refusal": "No"}]}]})
        with tempfile.TemporaryDirectory() as temp, patch.dict("os.environ", {"OPENAI_API_KEY": "test-only"}), \
                patch("pipeline.content_processing.httpx.Client") as client:
            client.return_value.__enter__.return_value.post.return_value = response
            with self.assertRaisesRegex(ValueError, "declined"):
                ResponsesClient("test", temp).call("test", "extract", {}, EXTRACT_SCHEMA)
            self.assertFalse((Path(temp) / "calls.json").exists())

    def test_mocked_run_writes_importable_bundle_and_detects_edits(self):
        from pipeline import process_psa_content as pipeline
        from pipeline import validate_content as validation
        from pipeline.content_processing import ROOT, read_json, write_json
        draft, spec, plan, lesson, quizzes, pages, judge, data = fixture()
        plan.update(provided_by="Synthetic integration test", lessons=[spec], source_ids=["src-test"])
        topic = data["topics"][0]
        topic["name"] = "Symptoms and disease progression"

        class FakeClient:
            def __init__(self, model, output, temperature):
                self.output, self.calls = output, []

            def call(self, stage, prompt_name, payload, schema, images=()):
                result = copy.deepcopy(draft if prompt_name == "draft" else judge)
                self.calls.append({"stage": stage, "model": "synthetic-test-model", "seconds": 0,
                                   "result": result})
                write_json(self.output / "evidence.json", {"calls": self.calls})
                return result

        with tempfile.TemporaryDirectory() as temp:
            original = Path(temp) / "synthetic.txt"
            original.write_text("Synthetic source for tests only.", encoding="utf-8")
            source = {**data["sources"][0], "file_hash": digest(original.read_bytes()),
                      "local_file": str(original), "role": "educational_candidate"}
            out = Path(temp) / "run"
            args = Namespace(out=out, manifest=Path("unused.yaml"), model="synthetic-test-model",
                             temperature=None, reuse_sources=None)
            with patch.object(pipeline, "load_plan", return_value=(plan, data["disease"], topic)), \
                    patch.object(pipeline, "source_records", return_value=[source]), \
                    patch.object(pipeline, "ingest", return_value=(pages, [])), \
                    patch.object(pipeline, "ResponsesClient", FakeClient):
                pipeline.run(args)
            self.assertEqual({"evidence.json", "eval_report.md", "lessons"},
                             {p.name for p in out.iterdir() if not p.name.startswith("psa-")})
            export_path = out / "psa-symptoms-and-disease-progression.json"
            exported = read_json(export_path)
            self.assertEqual([], validate_content(exported, pages))
            real_read = validation.read_json

            def fake_inventory(path):
                if Path(path) == ROOT / "data/psa/source-inventory.json":
                    return [source]
                return real_read(path)

            with patch.object(validation, "read_json", side_effect=fake_inventory):
                self.assertEqual([], validation.validate_run(out))
                exported["lessons"][0]["pages"][0]["body"] += " An unsupported sentence."
                write_json(export_path, exported)
                errors = validation.validate_run(out)
                self.assertTrue(any("export changed" in e for e in errors))

    def test_failed_evidence_produces_no_importable_export(self):
        from pipeline import process_psa_content as pipeline
        from pipeline.content_processing import write_json
        draft, spec, plan, lesson, quizzes, pages, judge, data = fixture()
        plan.update(provided_by="Synthetic test", lessons=[spec], source_ids=["src-test"])
        judge["quizzes"][0]["support"] = "unsupported"

        class FakeClient:
            stages = []

            def __init__(self, *args):
                self.calls = []

            def call(self, stage, prompt_name, *args):
                self.stages.append(stage)
                return copy.deepcopy(draft if prompt_name == "draft" else judge)

        source = {**data["sources"][0], "local_file": "unused"}
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / "run"
            args = Namespace(out=out, manifest=Path("unused"), model="test", temperature=None, reuse_sources=None)
            with patch.object(pipeline, "load_plan", return_value=(plan, data["disease"], data["topics"][0])), \
                    patch.object(pipeline, "source_records", return_value=[source]), \
                    patch.object(pipeline, "ingest", return_value=(pages, [])), \
                    patch.object(pipeline, "ResponsesClient", FakeClient):
                with self.assertRaisesRegex(ValueError, "manual revision"):
                    pipeline.run(args)
            self.assertEqual([], list(out.glob("psa-*.json")))
            self.assertEqual(3, sum(s.startswith("draft-") for s in FakeClient.stages))


if __name__ == "__main__":
    unittest.main()

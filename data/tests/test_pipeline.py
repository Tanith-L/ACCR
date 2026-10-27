"""Pipeline wiring with a fake generator, so it runs without an API key."""
from pathlib import Path

from rheumnotes_data.generator import (Concept, DraftClaim, DraftQuizQuestion, LessonDraft,
                                       LessonPlan, LessonPlanItem)
from rheumnotes_data.ingest import load_document
from rheumnotes_data.pipeline import run
from rheumnotes_data.validate import validate_bundle

STRUCTURE = {
    "disease": {"id": "psa", "name": "Psoriatic arthritis"},
    "topics": [{"id": "overview", "name": "Understanding PsA", "order": 1, "icon": "tbd",
                "subtopics": [{"id": "overview-basics", "name": "PsA basics", "order": 1, "lessons": []}]}],
}


class FakeGenerator:
    model = "fake"

    def __init__(self, supported=True):
        self.supported = supported

    def extract_concepts(self, doc):
        return [Concept(name=f"concept {i}", explanation="test", source_id=doc.id, page=1, quote=None)
                for i in range(2)]

    def plan_lessons(self, topic, concepts, max_lessons):
        return LessonPlan(lessons=[LessonPlanItem(subtopic_id="overview-basics", title=f"Lesson {i}",
                                                  concept_names=[concepts[0].name]) for i in range(2)])

    def draft_lesson(self, plan, concepts, docs):
        return LessonDraft(title=plan.title, summary="Test summary.", est_minutes=2,
                           body_markdown="Short test sentence. Another one.", key_takeaways=["Test."],
                           claims=[DraftClaim(text="Test claim.", source_id=docs[0].id, page=1)],
                           quiz=[DraftQuizQuestion(question="Q?", options=["a", "b"], answer=0, feedback="f")])

    def verify_claims(self, claims, docs):
        return [self.supported] * len(claims)


def _doc(tmp_path: Path):
    src = tmp_path / "test_source.md"
    src.write_text("Page one text.\n---page---\nPage two text.")
    return load_document(src)


def test_supported_claims_export_as_checked(tmp_path):
    bundle, trace = run([_doc(tmp_path)], FakeGenerator(), "overview", structure=STRUCTURE)
    assert validate_bundle(bundle, media_dir=None).ok
    assert [l["id"] for l in bundle["lessons"]] == ["psa-overview-01", "psa-overview-02"]
    assert {l["status"] for l in bundle["lessons"]} == {"checked"}
    assert len(trace["concepts"]) == 2


def test_unsupported_claims_stay_draft(tmp_path):
    bundle, _ = run([_doc(tmp_path)], FakeGenerator(supported=False), "overview", structure=STRUCTURE)
    assert {l["status"] for l in bundle["lessons"]} == {"draft"}


def test_changed_lesson_gets_new_version(tmp_path):
    first, _ = run([_doc(tmp_path)], FakeGenerator(), "overview", structure=STRUCTURE)
    same, _ = run([_doc(tmp_path)], FakeGenerator(), "overview", structure=STRUCTURE, previous=first)
    assert [l["version"] for l in same["lessons"]] == [1, 1]
    first["lessons"][0]["body_markdown"] = "Older text."
    bumped, _ = run([_doc(tmp_path)], FakeGenerator(), "overview", structure=STRUCTURE, previous=first)
    assert [l["version"] for l in bumped["lessons"]] == [2, 1]

import copy
import json
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "scripts"))

import contract  # noqa: E402

SCHEMA_PATH = contract.find_upwards(BACKEND, "schema/content.schema.json")
MOCK = BACKEND / "fixtures" / "mock_export.json"

pytestmark = pytest.mark.skipif(SCHEMA_PATH is None, reason="schema/content.schema.json not found")


@pytest.fixture(scope="session")
def schema():
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


@pytest.fixture
def mock():
    return json.loads(MOCK.read_text(encoding="utf-8"))


def passes_gate(checks: dict) -> bool:
    """The 'checked' rule from docs/content-json-schema.md."""
    return (
        checks.get("schema_valid") is True
        and checks.get("contradicted") == 0
        and checks.get("unsupported") == 0
        and checks.get("citation_accuracy") == 1.0
        and checks.get("numbers_ok") is True
        and checks.get("safety_flags") == []
        and checks.get("fk_grade", 99) <= 8
    )


# --- mock_export.json -------------------------------------------------------

def test_mock_export_is_valid(mock, schema):
    assert contract.validate_export(mock, schema) == []


def test_mock_export_shape(mock):
    assert len(mock["topics"]) == 1
    assert len(mock["lessons"]) == 3
    assert (MOCK.parent / mock["media"][0]["file"]).is_file()


def test_mock_checked_lessons_pass_gate_and_draft_fails(mock):
    by_status = {l["id"]: l for l in mock["lessons"]}
    assert {i for i, l in by_status.items() if l["status"] == "checked"} == {"psa-dx-01", "psa-dx-02"}
    for l in mock["lessons"]:
        assert passes_gate(l["checks"]) == (l["status"] == "checked"), l["id"]
        assert l["claims"], "mock lessons carry claims with source quotes"


def test_mock_check_counts_match_claims(mock):
    for l in mock["lessons"]:
        c, k = l["claims"], l["checks"]
        assert k["claims_total"] == len(c)
        for label in ("supported", "unsupported", "contradicted"):
            assert k[label] == sum(x["support"] == label for x in c)


@pytest.mark.parametrize("mutate, message", [
    (lambda d: d["lessons"][0].update(est_minutes=9), "est_minutes"),
    (lambda d: d["lessons"][0].update(status="published"), "status"),
    (lambda d: d["lessons"][0].pop("claims"), "claims"),
    (lambda d: d["lessons"][0]["pages"].extend([{"order": n, "body": "x"} for n in range(2, 6)]), "pages"),
    (lambda d: d["lessons"][0].update(id="Bad_ID"), "id"),
    (lambda d: d.update(schema_version="2.0"), "schema_version"),
    (lambda d: d["quizzes"][0].update(answer=5), "answer"),
    (lambda d: d["lessons"][0].update(surprise=1), "surprise"),
])
def test_schema_rejects_bad_mock(mock, schema, mutate, message):
    mutate(mock)
    errors = contract.validate_export(mock, schema)
    assert errors and any(message in e for e in errors)


@pytest.mark.parametrize("mutate, message", [
    (lambda d: d["quizzes"][0].update(answer=2), "not a valid option index"),
    (lambda d: d["quizzes"][0].update(lesson_id="psa-dx-99"), "unknown lesson_id"),
    (lambda d: d["lessons"][0]["images"][0].update(media_id="nope"), "unknown media_id"),
    (lambda d: d["lessons"][0]["claims"][0].update(source_id="src-nope"), "unknown source_id"),
    (lambda d: d["topics"][0]["subtopics"][0]["lesson_ids"].append("psa-dx-99"), "unknown lesson"),
    (lambda d: d["topics"][0]["subtopics"][1]["lesson_ids"].append("psa-dx-01"), "expected 1"),
    (lambda d: d["lessons"].append(copy.deepcopy(d["lessons"][0])), "duplicate lesson id"),
    (lambda d: d["lessons"][0].update(subtopic_id="dx-imaging"), "belongs to"),
    (lambda d: d["lessons"][0]["images"][0].update(page=3), "only 2 pages"),
])
def test_cross_reference_errors(mock, schema, mutate, message):
    mutate(mock)
    assert any(message in e for e in contract.validate_export(mock, schema))

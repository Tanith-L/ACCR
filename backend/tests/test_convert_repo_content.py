import copy
import json
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "scripts"))

import convert_repo_content as conv  # noqa: E402

SCHEMA_PATH = conv.find_upwards(BACKEND, "schema/content.schema.json")
_topics = conv.find_upwards(BACKEND, "topics.yaml")
REPO_ROOT = _topics.parent if _topics else None
MOCK = BACKEND / "fixtures" / "mock_export.json"
NOW = "2026-10-28T15:00:00Z"

needs_schema = pytest.mark.skipif(SCHEMA_PATH is None, reason="schema/content.schema.json not found")
needs_repo = pytest.mark.skipif(REPO_ROOT is None, reason="repo content (topics.yaml) not found")


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

@needs_schema
def test_mock_export_is_valid(mock, schema):
    assert conv.validate_export(mock, schema) == []


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


@needs_schema
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
    errors = conv.validate_export(mock, schema)
    assert errors and any(message in e for e in errors)


@needs_schema
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
    assert any(message in e for e in conv.validate_export(mock, schema))


# --- parsing helpers --------------------------------------------------------

def test_parse_citations_first_page_and_aliases():
    assert conv.parse_citations("PsA One-Pager Intro p.1; mindmap p.1") == [("PsA One-Pager Intro", 1), ("mindmap", 1)]
    assert conv.parse_citations("Management Guidelines of Arthritis and Autoimmune Diseases pp.9, 12-13") == [
        ("Management Guidelines of Arthritis and Autoimmune Diseases", 9)]
    assert conv.parse_citations("GRAPPA domains in PSA which guide treatment decisions p.1") == [
        ("GRAPPA domains in PSA poster", 1)]


def test_parse_citations_rejects_garbage():
    with pytest.raises(conv.ConversionError):
        conv.parse_citations("no page number here")


def test_slug_drops_apostrophes():
    assert conv.slug("Murphy’s Laws of Arthritis Preface") == "murphys-laws-of-arthritis-preface"
    assert conv.slug("PsA & AS Symptoms") == "psa-as-symptoms"


def test_split_pages():
    assert conv.split_pages("One.\n\nTwo.") == [{"order": 1, "body": "One.\n\nTwo."}]
    pages = conv.split_pages("A.\n\n---page---\n\nB.\n\n---page---\nC.\n")
    assert pages == [{"order": 1, "body": "A."}, {"order": 2, "body": "B."}, {"order": 3, "body": "C."}]


def test_readability_is_sane():
    easy = conv.readability("The cat sat. The dog ran. We like it.")
    hard = conv.readability("Rheumatological classification criteria necessitate comprehensive "
                            "musculoskeletal examination, immunological investigations and radiographic assessment.")
    assert easy["fk_grade"] < 3 and hard["fk_grade"] > 15
    assert conv.readability("") == {"fk_grade": 0.0, "smog": 0.0}


# --- conversion of the real repo content ------------------------------------

@pytest.fixture(scope="module")
def real():
    return conv.convert(REPO_ROOT, NOW)


@needs_schema
@needs_repo
def test_real_content_converts_to_valid_export(real, schema):
    assert conv.validate_export(real, schema) == []


@needs_repo
def test_real_content_stays_draft_without_claims(real):
    assert real["lessons"]
    for l in real["lessons"]:
        assert l["status"] == "draft" and l["generated_by"] == "human"
        assert l["claims"] == []
        assert set(l["checks"]) == {"schema_valid", "fk_grade", "smog"}
        assert not passes_gate(l["checks"])
    assert all(q["status"] == "draft" for q in real["quizzes"])


@needs_repo
def test_real_content_matches_source_files(real):
    n_lessons = len(list((REPO_ROOT / "lessons").glob("*.md")))
    assert len(real["lessons"]) == n_lessons
    listed = [i for t in real["topics"] for s in t["subtopics"] for i in s["lesson_ids"]]
    assert sorted(listed) == sorted(l["id"] for l in real["lessons"])
    assert len(real["media"]) == len(list((REPO_ROOT / "media").glob("*.jpg")))
    assert all((REPO_ROOT / "media" / m["file"]).is_file() for m in real["media"])
    assert [t["order"] for t in real["topics"]] == sorted(t["order"] for t in real["topics"])
    assert all(t["icon"] is None for t in real["topics"])  # "tbd" is not an icon name


@needs_repo
def test_real_content_sources_are_deduplicated(real):
    ids = [s["id"] for s in real["sources"]]
    assert len(ids) == len(set(ids))
    assert "src-psa-one-pager-intro" in ids
    assert not any("which-guide" in i or "top-10" in i or "8th-grade" in i for i in ids)


# --- CLI behaviour on small synthetic repos ---------------------------------

def make_repo(tmp_path, body="Para one.\n\n---page---\n\nPara two.", lesson_extra="", quiz_answer=1):
    (tmp_path / "lessons").mkdir()
    (tmp_path / "media").mkdir()
    (tmp_path / "topics.yaml").write_text(
        "disease: {id: psa, name: Psoriatic arthritis}\n"
        "topics:\n- id: dx\n  name: Diagnosis\n  order: 1\n  icon: tbd\n  subtopics:\n"
        "  - id: dx-a\n    name: A\n    order: 1\n    lessons: [psa-dx-01]\n", encoding="utf-8")
    (tmp_path / "lessons" / "psa-dx-01.md").write_text(
        "---\nid: psa-dx-01\ntitle: T\ntopic_id: dx\nsubtopic_id: dx-a\nest_minutes: 2\n"
        "source: Doc A p.1; Doc B pp.4-5\nstatus: draft\nkey_takeaways:\n- One.\n"
        f"images:\n- file: pic.jpg\n  page: 2\n{lesson_extra}---\n\n{body}\n", encoding="utf-8")
    (tmp_path / "quizzes.yaml").write_text(
        "- id: psa-dx-01-q1\n  lesson_id: psa-dx-01\n  question: Q?\n  options: [a, b]\n"
        f"  answer: {quiz_answer}\n  feedback: F.\n  source: Doc B pp.4-5\n  status: draft\n", encoding="utf-8")
    (tmp_path / "media" / "media.yaml").write_text(
        "- file: pic.jpg\n  alt_text: A picture\n  credit: Me\n  source: Doc A p.1\n  used_in: [psa-dx-01]\n", encoding="utf-8")
    return tmp_path


@needs_schema
def test_synthetic_conversion(tmp_path, schema):
    data = conv.convert(make_repo(tmp_path), NOW)
    assert conv.validate_export(data, schema) == []
    lesson = data["lessons"][0]
    assert [p["body"] for p in lesson["pages"]] == ["Para one.", "Para two."]
    assert lesson["images"] == [{"media_id": "pic", "page": 2}]
    assert [s["id"] for s in data["sources"]] == ["src-doc-a", "src-doc-b"]
    assert data["quizzes"][0]["source_id"] == "src-doc-b" and data["quizzes"][0]["source_page"] == 4
    assert data["media"][0]["id"] == "pic" and data["topics"][0]["icon"] is None
    assert data["run"]["run_id"] == "2026-10-28-repo"


def run_cli(repo, tmp_path, *extra):
    out = tmp_path / "out" / "export.json"
    code = conv.main(["--repo-root", str(repo), "--schema", str(SCHEMA_PATH), "--out", str(out), *extra])
    return code, out


@needs_schema
def test_cli_writes_valid_file(tmp_path, schema, capsys):
    code, out = run_cli(make_repo(tmp_path), tmp_path)
    assert code == 0 and out.is_file()
    assert conv.validate_export(json.loads(out.read_text(encoding="utf-8")), schema) == []
    assert "1 lessons" in capsys.readouterr().out
    assert not list(out.parent.glob("*.tmp"))


@needs_schema
def test_cli_dry_run_writes_nothing(tmp_path):
    code, out = run_cli(make_repo(tmp_path), tmp_path, "--dry-run")
    assert code == 0 and not out.exists() and not out.parent.exists()


@needs_schema
def test_cli_rejects_invalid_content_and_writes_nothing(tmp_path, capsys):
    code, out = run_cli(make_repo(tmp_path, quiz_answer=2), tmp_path)
    assert code == 1 and not out.parent.exists()
    assert "not a valid option index" in capsys.readouterr().err


@needs_schema
def test_cli_fails_on_missing_lesson_file(tmp_path, capsys):
    repo = make_repo(tmp_path)
    (repo / "lessons" / "psa-dx-01.md").unlink()
    code, out = run_cli(repo, tmp_path)
    assert code == 1 and not out.parent.exists()
    assert "psa-dx-01" in capsys.readouterr().err


@needs_schema
def test_cli_fails_on_missing_front_matter(tmp_path, capsys):
    repo = make_repo(tmp_path)
    (repo / "lessons" / "psa-dx-01.md").write_text("no front matter\n", encoding="utf-8")
    code, _ = run_cli(repo, tmp_path)
    assert code == 1 and "front matter" in capsys.readouterr().err


@needs_schema
def test_cli_fails_on_unparseable_citation(tmp_path, capsys):
    repo = make_repo(tmp_path)
    path = repo / "lessons" / "psa-dx-01.md"
    path.write_text(path.read_text(encoding="utf-8").replace("Doc A p.1; Doc B pp.4-5", "Doc A"), encoding="utf-8")
    code, _ = run_cli(repo, tmp_path)
    assert code == 1 and "cannot parse source citation" in capsys.readouterr().err


@needs_schema
def test_cli_fails_on_unknown_image(tmp_path, capsys):
    repo = make_repo(tmp_path)
    (repo / "media" / "media.yaml").write_text(
        "- file: other.jpg\n  alt_text: x\n  credit: y\n  source: Doc A p.1\n", encoding="utf-8")
    code, _ = run_cli(repo, tmp_path)
    assert code == 1 and "unknown media_id" in capsys.readouterr().err


@needs_schema
@needs_repo
def test_cli_on_real_repo_is_read_only(tmp_path):
    before = sorted((p, p.stat().st_mtime_ns) for p in REPO_ROOT.glob("lessons/*.md"))
    code, out = run_cli(REPO_ROOT, tmp_path)
    assert code == 0 and out.is_file()
    assert before == sorted((p, p.stat().st_mtime_ns) for p in REPO_ROOT.glob("lessons/*.md"))

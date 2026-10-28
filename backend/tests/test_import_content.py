import copy
import json
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "scripts"))

import convert_repo_content as conv  # noqa: E402
import import_content as imp  # noqa: E402

SCHEMA_PATH = conv.find_upwards(BACKEND, "schema/content.schema.json")
MOCK = BACKEND / "fixtures" / "mock_export.json"

pytestmark = pytest.mark.skipif(SCHEMA_PATH is None, reason="schema/content.schema.json not found")


@pytest.fixture(autouse=True)
def no_real_settings(monkeypatch):
    """Tests in this file must never reach the real project through .env."""
    monkeypatch.setattr(imp, "load_settings", lambda start: {})


@pytest.fixture(scope="module")
def schema():
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


@pytest.fixture
def mock():
    return json.loads(MOCK.read_text(encoding="utf-8"))


def write_export(tmp_path, data, with_media=True):
    path = tmp_path / "export.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    if with_media:
        for m in data["media"]:
            (tmp_path / m["file"]).write_bytes((MOCK.parent / "mock-joints.png").read_bytes())
    return path


def run(path, *extra):
    return imp.main([str(path), "--schema", str(SCHEMA_PATH), *extra])


def by_id(plan):
    return {p["id"]: p for p in plan}


# --- §5.2 status gate -------------------------------------------------------

def good_checks():
    return {"schema_valid": True, "citation_accuracy": 1.0, "unsupported": 0, "contradicted": 0,
            "numbers_ok": True, "safety_flags": [], "fk_grade": 6.8}


def test_gate_passes_clean_checks():
    assert imp.gate_failures(good_checks()) == []


@pytest.mark.parametrize("change", [
    {"schema_valid": False}, {"citation_accuracy": 0.9}, {"unsupported": 1}, {"contradicted": 1},
    {"numbers_ok": False}, {"safety_flags": ["dosing"]}, {"fk_grade": 8.1},
])
def test_gate_fails_each_condition(change):
    assert imp.gate_failures({**good_checks(), **change})


def test_gate_boundary_fk_8_passes():
    assert imp.gate_failures({**good_checks(), "fk_grade": 8}) == []


def test_gate_fails_when_fields_missing():
    assert len(imp.gate_failures({"schema_valid": True, "fk_grade": 5.0})) >= 3
    assert imp.gate_failures({"schema_valid": True})


def test_effective_status_downgrades_failing_checked_lesson():
    lesson = {"status": "checked", "checks": {**good_checks(), "unsupported": 2}}
    status, failures = imp.effective_status(lesson)
    assert status == "draft" and failures


def test_effective_status_keeps_clean_checked_and_draft():
    assert imp.effective_status({"status": "checked", "checks": good_checks()}) == ("checked", [])
    assert imp.effective_status({"status": "draft", "checks": good_checks()}) == ("draft", [])


# --- §5.3 versioning --------------------------------------------------------

def test_content_hash_ignores_claims_and_status_but_not_content(mock):
    lesson = mock["lessons"][0]
    quizzes = [q for q in mock["quizzes"] if q["lesson_id"] == lesson["id"]]
    base = imp.content_hash(lesson, quizzes)
    assert len(base) == 64

    same = copy.deepcopy(lesson)
    same["claims"] = []
    same["status"] = "draft"
    same["checks"]["fk_grade"] = 1.0
    assert imp.content_hash(same, quizzes) == base

    for mutate in (
        lambda l: l.update(title="Other"),
        lambda l: l.update(est_minutes=4),
        lambda l: l["pages"][0].update(body="Changed."),
        lambda l: l["key_takeaways"].append("More."),
        lambda l: l["images"].clear(),
    ):
        changed = copy.deepcopy(lesson)
        mutate(changed)
        assert imp.content_hash(changed, quizzes) != base
    changed_quiz = copy.deepcopy(quizzes)
    changed_quiz[0]["answer"] = 0
    assert imp.content_hash(lesson, changed_quiz) != base


@pytest.mark.parametrize("latest, expected", [
    (None, ("insert", 1)),
    ({"version": 1, "status": "published", "content_hash": "same"}, ("skip", 1)),
    ({"version": 2, "status": "draft", "content_hash": "old"}, ("update", 2)),
    ({"version": 1, "status": "checked", "content_hash": "old"}, ("update", 1)),
    ({"version": 1, "status": "reviewed", "content_hash": "old"}, ("insert", 2)),
    ({"version": 3, "status": "published", "content_hash": "old"}, ("insert", 4)),
    ({"version": 2, "status": "archived", "content_hash": "old"}, ("insert", 3)),
    # same patient-facing content, evidence differs
    ({"version": 1, "status": "draft", "content_hash": "same", "evidence_hash": "e0"}, ("update", 1)),
    ({"version": 1, "status": "checked", "content_hash": "same", "evidence_hash": "e0"}, ("update", 1)),
    ({"version": 1, "status": "draft", "content_hash": "same"}, ("update", 1)),  # nothing stored yet
    ({"version": 1, "status": "draft", "content_hash": "same", "evidence_hash": "e1"}, ("skip", 1)),
    ({"version": 1, "status": "reviewed", "content_hash": "same", "evidence_hash": "e0"}, ("skip", 1)),
    ({"version": 2, "status": "published", "content_hash": "same", "evidence_hash": "e0"}, ("skip", 2)),
    ({"version": 1, "status": "archived", "content_hash": "same", "evidence_hash": "e0"}, ("skip", 1)),
])
def test_decide(latest, expected):
    assert imp.decide(latest, "same", "e1") == expected


def test_plan_empty_database_inserts_everything(mock):
    plan = by_id(imp.plan_lessons(mock, {}))
    assert {p["action"] for p in plan.values()} == {"insert"}
    assert {p["version"] for p in plan.values()} == {1}
    assert plan["psa-dx-01"]["status"] == "checked" and plan["psa-dx-03"]["status"] == "draft"
    assert [plan[i]["sort_order"] for i in ("psa-dx-01", "psa-dx-02", "psa-dx-03")] == [1, 2, 1]
    assert plan["psa-dx-01"]["claims"] == 4 and plan["psa-dx-01"]["quizzes"] == 1


def stored_from(plan, status=None):
    return {p["id"]: {"version": p["version"], "status": status or p["status"],
                      "content_hash": p["content_hash"], "evidence_hash": p["evidence_hash"]} for p in plan}


def test_plan_is_idempotent_on_reimport(mock):
    first = imp.plan_lessons(mock, {})
    stored = stored_from(first)
    again = imp.plan_lessons(mock, stored)
    assert {p["action"] for p in again} == {"skip"}
    assert imp.build_report(mock, again)["claims"] == 0


def test_plan_published_lesson_gets_new_version_when_content_changes(mock):
    stored = stored_from(imp.plan_lessons(mock, {}), "published")
    mock["lessons"][0]["pages"][0]["body"] = "A corrected first page."
    plan = by_id(imp.plan_lessons(mock, stored))
    assert (plan["psa-dx-01"]["action"], plan["psa-dx-01"]["version"]) == ("insert", 2)
    assert plan["psa-dx-02"]["action"] == "skip"


def test_evidence_change_never_touches_reviewed_or_published(mock):
    for status in ("reviewed", "published"):
        stored = stored_from(imp.plan_lessons(mock, {}), status)
        changed = copy.deepcopy(mock)
        changed["lessons"][0]["checks"]["fk_grade"] = 7.9
        changed["lessons"][0]["claims"] = []
        assert by_id(imp.plan_lessons(changed, stored))["psa-dx-01"]["action"] == "skip"


def test_draft_gains_claims_and_becomes_checked_in_place(mock):
    """Same text, draft without claims, then re-export with claims and checked."""
    bare = copy.deepcopy(mock)
    lesson = bare["lessons"][0]
    lesson["claims"], lesson["status"] = [], "draft"
    lesson["checks"] = {"schema_valid": True, "fk_grade": 4.6}
    stored = stored_from(imp.plan_lessons(bare, {}))
    assert stored["psa-dx-01"]["status"] == "draft"

    plan = imp.plan_lessons(mock, stored)
    first = by_id(plan)["psa-dx-01"]
    assert (first["action"], first["version"], first["status"], first["evidence_only"]) == ("update", 1, "checked", True)
    assert by_id(plan)["psa-dx-02"]["action"] == "skip"  # unchanged evidence
    report = imp.build_report(mock, plan)
    assert (report["updated"], report["updated_evidence_only"], report["skipped"]) == (1, 1, 2)


def test_checked_lesson_that_now_fails_gate_is_updated_to_draft(mock):
    stored = stored_from(imp.plan_lessons(mock, {}))
    mock["lessons"][0]["checks"]["unsupported"] = 1
    p = by_id(imp.plan_lessons(mock, stored))["psa-dx-01"]
    assert (p["action"], p["status"], p["downgraded"]) == ("update", "draft", True)


def test_evidence_only_update_is_reported(tmp_path, mock, capsys):
    stored = stored_from(imp.plan_lessons(mock, {}))
    stored["psa-dx-01"]["evidence_hash"] = "stale"
    snap = tmp_path / "existing.json"
    snap.write_text(json.dumps(stored), encoding="utf-8")
    assert run(MOCK, "--dry-run", "--existing", str(snap)) == 0
    out = capsys.readouterr().out
    assert "updated 1 (1 evidence only)" in out and "update as checked (claims/checks/status only)" in out


def test_plan_marks_downgrade(mock):
    mock["lessons"][1]["checks"]["safety_flags"] = ["brand name"]
    p = by_id(imp.plan_lessons(mock, {}))["psa-dx-02"]
    assert p["status"] == "draft" and p["downgraded"] and "safety_flags" in p["gate_failures"][0]
    assert imp.build_report(mock, imp.plan_lessons(mock, {}))["downgraded"] == 1


def test_report_counts(mock):
    report = imp.build_report(mock, imp.plan_lessons(mock, {}))
    assert (report["inserted"], report["updated"], report["skipped"], report["downgraded"]) == (3, 0, 0, 0)
    assert (report["topics"], report["subtopics"], report["claims"], report["quiz_items"], report["media_uploads"]) \
        == (1, 2, 9, 3, 1)


# --- §5.1 validation: any error rejects the whole file ----------------------

def test_valid_mock_dry_run(capsys):
    assert run(MOCK, "--dry-run") == 0
    out = capsys.readouterr().out
    assert "inserted 3" in out and "dry run: nothing uploaded or written" in out
    assert "psa-dx-03 v1: insert as draft" in out


def test_real_import_needs_settings(capsys):
    assert run(MOCK) == 2
    err = capsys.readouterr().err
    assert "missing settings" in err and "SUPABASE_SERVICE_KEY" in err


def test_from_db_needs_settings_and_excludes_existing(capsys, tmp_path, monkeypatch):
    assert run(MOCK, "--dry-run", "--from-db") == 2
    assert "SUPABASE_DB_URL" in capsys.readouterr().err
    snap = tmp_path / "e.json"
    snap.write_text("{}", encoding="utf-8")
    monkeypatch.setattr(imp, "load_settings", lambda start: {"SUPABASE_DB_URL": "x"})
    assert run(MOCK, "--dry-run", "--from-db", "--existing", str(snap)) == 2
    assert "not both" in capsys.readouterr().err


def test_duplicate_image_in_one_lesson_rejected(tmp_path, mock, capsys):
    mock["lessons"][0]["images"].append({"media_id": "mock-joints", "page": 2})
    assert run(write_export(tmp_path, mock), "--dry-run") == 1
    assert "image" in capsys.readouterr().err


def test_dry_run_reads_existing_snapshot(tmp_path, mock, capsys):
    stored = stored_from(imp.plan_lessons(mock, {}), "published")
    snap = tmp_path / "existing.json"
    snap.write_text(json.dumps(stored), encoding="utf-8")
    assert run(MOCK, "--dry-run", "--existing", str(snap)) == 0
    assert "skipped 3" in capsys.readouterr().out


def test_downgrade_is_reported(tmp_path, mock, capsys):
    mock["lessons"][0]["checks"]["contradicted"] = 1
    assert run(write_export(tmp_path, mock), "--dry-run") == 0
    out = capsys.readouterr().out
    assert "downgraded to draft 1" in out and "contradicted is 1" in out


@pytest.mark.parametrize("mutate, message", [
    (lambda d: d["lessons"][0].update(est_minutes=9), "est_minutes"),
    (lambda d: d["quizzes"][0].update(answer=2), "not a valid option index"),
    (lambda d: d["lessons"][0]["images"][0].update(media_id="nope"), "unknown media_id"),
    (lambda d: d["lessons"].append(copy.deepcopy(d["lessons"][0])), "duplicate lesson id"),
    (lambda d: d["topics"][0]["subtopics"][0]["lesson_ids"].append("psa-dx-99"), "unknown lesson"),
])
def test_any_error_rejects_whole_file(tmp_path, mock, capsys, mutate, message):
    mutate(mock)
    assert run(write_export(tmp_path, mock), "--dry-run") == 1
    err = capsys.readouterr().err
    assert "file rejected" in err and message in err


def test_missing_media_file_rejects(tmp_path, mock, capsys):
    assert run(write_export(tmp_path, mock, with_media=False), "--dry-run") == 1
    assert "mock-joints.png not found" in capsys.readouterr().err


def test_oversized_media_rejects(tmp_path, mock, capsys):
    path = write_export(tmp_path, mock)
    (tmp_path / "mock-joints.png").write_bytes(b"0" * imp.MAX_MEDIA_BYTES)
    assert run(path, "--dry-run") == 1
    assert "limit" in capsys.readouterr().err


def test_media_dir_option(tmp_path, mock):
    out = tmp_path / "exports"
    out.mkdir()
    path = write_export(out, mock, with_media=False)
    images = tmp_path / "images"
    images.mkdir()
    (images / "mock-joints.png").write_bytes((MOCK.parent / "mock-joints.png").read_bytes())
    assert run(path, "--dry-run", "--media-dir", str(images)) == 0


@pytest.mark.parametrize("content", ["{not json", "[]", ""])
def test_corrupt_file_rejects(tmp_path, capsys, content):
    path = tmp_path / "export.json"
    path.write_text(content, encoding="utf-8")
    assert run(path, "--dry-run") == 1
    assert "file rejected" in capsys.readouterr().err


def test_missing_file_rejects(tmp_path, capsys):
    assert run(tmp_path / "nope.json", "--dry-run") == 1
    assert "cannot read" in capsys.readouterr().err


def test_bad_existing_snapshot_rejects(tmp_path, capsys):
    bad = tmp_path / "existing.json"
    bad.write_text("nope", encoding="utf-8")
    assert run(MOCK, "--dry-run", "--existing", str(bad)) == 1
    assert "cannot read" in capsys.readouterr().err


def test_dry_run_leaves_input_untouched(tmp_path, mock):
    path = write_export(tmp_path, mock)
    before = path.read_bytes()
    assert run(path, "--dry-run") == 0
    assert path.read_bytes() == before
    assert sorted(p.name for p in tmp_path.iterdir()) == ["export.json", "mock-joints.png"]


# --- converter output feeds the importer ------------------------------------

def test_converted_repo_content_imports_as_draft(tmp_path, schema, capsys):
    topics = conv.find_upwards(BACKEND, "topics.yaml")
    if topics is None:
        pytest.skip("repo content not found")
    data = conv.convert(topics.parent, "2026-10-28T15:00:00Z")
    path = write_export(tmp_path, data, with_media=False)
    assert run(path, "--dry-run", "--media-dir", str(topics.parent / "media")) == 0
    out = capsys.readouterr().out
    assert f"inserted {len(data['lessons'])}" in out and "downgraded to draft 0" in out
    assert {p["status"] for p in imp.plan_lessons(data, {})} == {"draft"}

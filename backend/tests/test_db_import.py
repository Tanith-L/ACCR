import copy

import psycopg
import pytest

import import_content as imp
from conftest import do_import, publish

pytestmark = pytest.mark.db

IDS = ("zzt-dx-01", "zzt-dx-02", "zzt-dx-03")


def rows(db, sql, params=None):
    return db.execute(sql, params).fetchall()


def count(db, table, where="true", params=()):
    return db.execute(f"select count(*) from {table} where {where}", params).fetchone()[0]


def test_every_row_matches_the_json(db, export):
    plan, result = do_import(db, export)
    assert [p["action"] for p in plan] == ["insert"] * 3

    db_lessons = {r[0]: r for r in rows(
        db, "select id, version, subtopic_id, sort_order, title, est_minutes, pages, key_takeaways, "
            "generated_by, checks, status::text, content_hash, evidence_hash from lessons where id like 'zzt-%'")}
    assert set(db_lessons) == set(IDS)
    by_plan = {p["id"]: p for p in plan}
    for lesson in export["lessons"]:
        r = db_lessons[lesson["id"]]
        assert r[1] == 1 and r[2] == lesson["subtopic_id"] and r[3] == by_plan[lesson["id"]]["sort_order"]
        assert (r[4], r[5], r[6], r[7], r[8]) == (
            lesson["title"], lesson["est_minutes"], lesson["pages"], lesson["key_takeaways"], lesson["generated_by"])
        assert r[9] == lesson["checks"]
        assert r[10] == by_plan[lesson["id"]]["status"] == lesson["status"]
        assert (r[11], r[12]) == (by_plan[lesson["id"]]["content_hash"], by_plan[lesson["id"]]["evidence_hash"])

    claims = rows(db, "select id, lesson_id, text, page, source_id, source_page, source_quote, support, quote_match "
                      "from lesson_claims where lesson_id like 'zzt-%' order by id")
    expected = sorted((c["id"], l["id"], c["text"], c["page"], c["source_id"], c["source_page"], c["source_quote"],
                       c["support"], float(c["quote_match"])) for l in export["lessons"] for c in l["claims"])
    assert [(*r[:8], float(r[8])) for r in claims] == expected

    quizzes = rows(db, "select id, lesson_id, question, options, answer, feedback, source_id, source_page, "
                       "source_quote, status::text from quiz_items where lesson_id like 'zzt-%' order by id")
    assert [r[:9] for r in quizzes] == sorted(
        (q["id"], q["lesson_id"], q["question"], q["options"], q["answer"], q["feedback"], q["source_id"],
         q["source_page"], q["source_quote"]) for q in export["quizzes"])
    # a quiz item is only 'checked' when its lesson is
    assert {r[0]: r[9] for r in quizzes} == {"zzt-dx-01-q1": "checked", "zzt-dx-02-q1": "checked", "zzt-dx-03-q1": "draft"}

    assert rows(db, "select lesson_id, lesson_version, media_id, page from lesson_media where lesson_id like 'zzt-%'") \
        == [("zzt-dx-01", 1, "zzt-joints", 1)]
    assert rows(db, "select id, storage_path, alt_text, credit, source_id from media where id like 'zzt-%'") \
        == [("zzt-joints", "zzt-joints.png", "Plain test image used in backend tests", "Test fixture", "src-zzt-onepager")]
    assert rows(db, "select id, title, type, provided_by, file_hash from sources where id like '%zzt%'") \
        == [("src-zzt-onepager", "Mock PsA One-Pager (test fixture)", "pdf", "Dr. Murphy", export["sources"][0]["file_hash"])]
    assert rows(db, "select id, name, sort_order, status::text from topics where id like 'zzt-%'") \
        == [("zzt-dx", "Understanding diagnosis", 2, "draft")]
    assert rows(db, "select id, topic_id, name, sort_order from subtopics where id like 'zzt-%' order by sort_order") \
        == [("zzt-criteria", "zzt-dx", "How PsA is recognized", 1), ("zzt-imaging", "zzt-dx", "Imaging", 2)]
    run = rows(db, "select run_id, file_name, schema_version, model, prompt_version, rows_inserted, rows_updated, "
                   "rows_skipped from import_runs where run_id = %s", (result["run_id"],))
    assert run == [("2026-10-28-mock", "test_export.json", "1.0", "mock-fixture", "draft-v1", 3, 0, 0)]


def test_reimport_changes_nothing(db, export):
    do_import(db, export)
    before = {t: count(db, t) for t in ("lessons", "lesson_claims", "quiz_items", "lesson_media", "topics", "media")}
    plan, result = do_import(db, export)
    assert {p["action"] for p in plan} == {"skip"}
    assert {t: count(db, t) for t in before} == before
    assert result["run_id"] == "2026-10-28-mock-2"  # same file again gets its own import_runs row
    assert rows(db, "select rows_inserted, rows_updated, rows_skipped from import_runs where run_id = %s",
                (result["run_id"],)) == [(0, 0, 3)]


def test_failure_halfway_writes_nothing(db, export):
    before = {t: count(db, t) for t in ("import_runs", "diseases", "sources", "topics", "lessons", "lesson_claims")}
    bad = copy.deepcopy(export)
    bad["quizzes"][2]["answer"] = 9  # violates the database check, after lessons are already written
    with pytest.raises(psycopg.errors.CheckViolation):
        do_import(db, bad)
    assert {t: count(db, t) for t in before} == before


def test_text_change_on_published_lesson_creates_version_2(db, export):
    do_import(db, export)
    publish(db, "zzt-dx-01")
    changed = copy.deepcopy(export)
    changed["lessons"][0]["title"] = "A corrected title"
    plan, _ = do_import(db, changed)
    p = {x["id"]: x for x in plan}["zzt-dx-01"]
    assert (p["action"], p["version"]) == ("insert", 2)
    assert rows(db, "select version, status::text, title from lessons where id = 'zzt-dx-01' order by version") \
        == [(1, "published", "How doctors diagnose PsA"), (2, "checked", "A corrected title")]
    # patients still see version 1
    assert rows(db, "select version, title from v_lessons where id = 'zzt-dx-01'") == [(1, "How doctors diagnose PsA")]
    assert count(db, "lesson_claims", "lesson_id = 'zzt-dx-01'") == 8  # claims for both versions


def test_draft_gains_evidence_and_becomes_checked_in_place(db, export):
    bare = copy.deepcopy(export)
    lesson = bare["lessons"][0]
    lesson["claims"], lesson["status"] = [], "draft"
    lesson["checks"] = {"schema_valid": True, "fk_grade": 4.6}
    do_import(db, bare)
    assert rows(db, "select version, status::text from lessons where id = 'zzt-dx-01'") == [(1, "draft")]
    assert count(db, "lesson_claims", "lesson_id = 'zzt-dx-01'") == 0

    plan, _ = do_import(db, export)
    p = {x["id"]: x for x in plan}["zzt-dx-01"]
    assert (p["action"], p["version"], p["evidence_only"]) == ("update", 1, True)
    assert rows(db, "select version, status::text from lessons where id = 'zzt-dx-01'") == [(1, "checked")]
    assert count(db, "lesson_claims", "lesson_id = 'zzt-dx-01'") == 4
    assert count(db, "quiz_items", "lesson_id = 'zzt-dx-01'") == 1  # replaced, not duplicated


def test_evidence_change_does_not_touch_published_version(db, export):
    do_import(db, export)
    publish(db, "zzt-dx-01")
    changed = copy.deepcopy(export)
    changed["lessons"][0]["claims"] = []
    changed["lessons"][0]["checks"]["fk_grade"] = 7.9
    plan, _ = do_import(db, changed)
    assert {x["id"]: x["action"] for x in plan}["zzt-dx-01"] == "skip"
    assert count(db, "lesson_claims", "lesson_id = 'zzt-dx-01'") == 4


def test_placement_and_names_update_without_new_version(db, export):
    do_import(db, export)
    publish(db, "zzt-dx-01")
    moved = copy.deepcopy(export)
    moved["topics"][0]["name"] = "Renamed topic"
    moved["topics"][0]["subtopics"][0]["lesson_ids"] = ["zzt-dx-02", "zzt-dx-01"]
    moved["media"][0]["alt_text"] = "Corrected caption"
    plan, _ = do_import(db, moved)
    assert {p["action"] for p in plan} == {"skip"}
    assert rows(db, "select id, sort_order from lessons where subtopic_id = 'zzt-criteria' order by sort_order") \
        == [("zzt-dx-02", 1), ("zzt-dx-01", 2)]
    assert rows(db, "select name, status::text from topics where id = 'zzt-dx'") == [("Renamed topic", "published")]
    assert rows(db, "select alt_text from media where id = 'zzt-joints'") == [("Corrected caption",)]


def test_unique_run_id(db):
    db.execute("insert into import_runs (run_id, file_name, schema_version) values ('r', 'f', '1.0')")
    assert imp.unique_run_id(db, "r") == "r-2"
    assert imp.unique_run_id(db, "other") == "other"


def test_fetch_existing_returns_latest_version(db, export):
    assert imp.fetch_existing(db, ["zzt-dx-01"]) == {}
    do_import(db, export)
    publish(db, "zzt-dx-01")
    changed = copy.deepcopy(export)
    changed["lessons"][0]["title"] = "v2"
    do_import(db, changed)
    latest = imp.fetch_existing(db, ["zzt-dx-01", "zzt-dx-99"])
    assert set(latest) == {"zzt-dx-01"} and latest["zzt-dx-01"]["version"] == 2
    assert latest["zzt-dx-01"]["status"] == "checked"


class FakeStorage:
    def __init__(self):
        self.calls = []

    def from_(self, bucket):
        self.bucket = bucket
        return self

    def upload(self, path, data, options):
        self.calls.append((self.bucket, path, len(data), options))


class FakeClient:
    def __init__(self):
        self.storage = FakeStorage()


def test_upload_media_uses_bucket_path_and_upsert(export):
    client = FakeClient()
    paths = imp.upload_media(client, export, imp.Path(__file__).resolve().parents[1] / "fixtures")
    assert paths == ["zzt-joints.png"]
    bucket, path, size, options = client.storage.calls[0]
    assert (bucket, path) == ("media", "zzt-joints.png") and size > 0
    assert options == {"content-type": "image/png", "upsert": "true"}

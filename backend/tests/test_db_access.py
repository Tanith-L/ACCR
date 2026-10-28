"""Access control, tested in SQL with the same role the anon key maps to.
The REST-level checks (real HTTP with the anon key) are in the API tests."""
import psycopg
import pytest

from conftest import do_import, publish

pytestmark = pytest.mark.db


@pytest.fixture
def as_anon(db, export):
    do_import(db, export)            # zzt-dx-01/02 checked, zzt-dx-03 draft
    publish(db, "zzt-dx-01")         # only this one is live
    db.execute("set local role anon")
    yield db
    db.execute("reset role")


def refused(db, sql, params=()):
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        with db.transaction():
            db.execute(sql, params)


def test_anon_sees_published_lesson_only(as_anon):
    assert as_anon.execute("select id from v_lessons where id like 'zzt-%' order by id").fetchall() == [("zzt-dx-01",)]
    assert as_anon.execute("select id from v_lessons where id = 'zzt-dx-03'").fetchall() == []  # draft: empty, not an error
    assert as_anon.execute("select id from v_quiz_items where lesson_id like 'zzt-%'").fetchall() == [("zzt-dx-01-q1",)]
    assert as_anon.execute("select id from v_topics where id like 'zzt-%'").fetchall() == [("zzt-dx",)]


def test_anon_view_columns_are_patient_facing_only(as_anon):
    cols = [d.name for d in as_anon.execute("select * from v_lessons limit 0").description]
    assert set(cols) == {"id", "version", "subtopic_id", "sort_order", "title", "est_minutes", "pages",
                         "key_takeaways", "images", "updated_at"}
    quiz_cols = [d.name for d in as_anon.execute("select * from v_quiz_items limit 0").description]
    assert set(quiz_cols) == {"id", "lesson_id", "question", "options", "answer", "feedback"}


def test_anon_learning_path_has_published_lessons_only(as_anon):
    path = as_anon.execute("select get_learning_path('zzt-dx')").fetchone()[0]
    assert [(s["id"], [l["id"] for l in s["lessons"]]) for s in path] == [("zzt-criteria", ["zzt-dx-01"])]
    assert as_anon.execute("select get_learning_path('no-such-topic')").fetchone()[0] == []


@pytest.mark.parametrize("table", ["lessons", "lesson_claims", "quiz_items", "topics", "subtopics", "sources",
                                   "media", "lesson_media", "reviews", "import_runs", "diseases"])
def test_anon_cannot_read_base_tables(as_anon, table):
    refused(as_anon, f"select * from {table}")


@pytest.mark.parametrize("sql", [
    "insert into topics (id, disease_id, name, sort_order) values ('zzt-x', 'zzt', 'x', 99)",
    "update lessons set title = 'hacked'",
    "update topics set name = 'hacked'",
    "delete from lessons",
    "delete from lesson_claims",
    "truncate lessons cascade",
])
def test_anon_cannot_write(as_anon, sql):
    refused(as_anon, sql)


@pytest.mark.parametrize("sql", [
    "select apply_review('zzt-dx-02', 1, 'anon', 5, 5, 5, 5, 5)",
    "select publish_lesson('zzt-dx-02', 1)",
    "select rollback_lesson('zzt-dx-01')",
])
def test_anon_cannot_call_review_or_publish_functions(as_anon, sql):
    refused(as_anon, sql)


def test_nothing_changed_after_the_refused_attempts(db, export):
    do_import(db, export)
    publish(db, "zzt-dx-01")
    db.execute("set local role anon")
    for sql in ("update lessons set title = 'hacked'", "select publish_lesson('zzt-dx-02', 1)"):
        refused(db, sql)
    db.execute("reset role")
    assert db.execute("select title, status::text from lessons where id = 'zzt-dx-02'").fetchall() \
        == [("Nail and finger clues", "checked")]


def test_authenticated_role_is_locked_down_too(db, export):
    do_import(db, export)
    db.execute("set local role authenticated")
    refused(db, "select * from lessons")
    refused(db, "select publish_lesson('zzt-dx-01', 1)")
    db.execute("reset role")

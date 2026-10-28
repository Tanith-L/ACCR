import psycopg
import pytest

from conftest import do_import, publish

pytestmark = pytest.mark.db


def status(db, lesson_id):
    return db.execute("select version, status::text from lessons where id = %s order by version",
                      (lesson_id,)).fetchall()


def review(db, lesson_id, version=1, acc=5, comp=5, read=5, safety=5, term=5):
    return db.execute("select apply_review(%s,%s,'Dr. Test',%s,%s,%s,%s,%s,'ok')",
                      (lesson_id, version, acc, comp, read, safety, term)).fetchone()[0]


def raises(db, exc, sql, params=()):
    with pytest.raises(exc):
        with db.transaction():  # savepoint, so the failure does not abort the test transaction
            db.execute(sql, params)


def test_only_checked_lessons_can_be_reviewed(db, export):
    do_import(db, export)
    with pytest.raises(psycopg.errors.RaiseException, match="only checked lessons can be reviewed"):
        with db.transaction():
            review(db, "zzt-dx-03")  # draft
    with pytest.raises(psycopg.errors.RaiseException, match="not found"):
        with db.transaction():
            review(db, "zzt-dx-99")


def test_only_reviewed_lessons_can_be_published(db, export):
    do_import(db, export)
    with pytest.raises(psycopg.errors.RaiseException, match="only reviewed lessons can be published"):
        with db.transaction():
            db.execute("select publish_lesson('zzt-dx-01', 1)")  # checked
    assert status(db, "zzt-dx-01") == [(1, "checked")]


@pytest.mark.parametrize("scores", [
    {"accuracy": 4}, {"safety": 4}, {"completeness": 3}, {"readability": 3}, {"terminology": 3},
])
def test_pass_rule_is_enforced_in_sql(db, export, scores):
    do_import(db, export)
    kw = {"acc": 5, "comp": 5, "read": 5, "safety": 5, "term": 5}
    names = {"accuracy": "acc", "completeness": "comp", "readability": "read", "safety": "safety", "terminology": "term"}
    kw.update({names[k]: v for k, v in scores.items()})
    assert review(db, "zzt-dx-01", **kw) == "revise"
    assert status(db, "zzt-dx-01") == [(1, "checked")]


def test_four_is_enough_for_the_other_scores(db, export):
    do_import(db, export)
    assert review(db, "zzt-dx-01", comp=4, read=4, term=4) == "reviewed"


def test_high_scores_cannot_override_reading_grade(db, export):
    do_import(db, export)
    db.execute("update lessons set checks = jsonb_set(checks, '{fk_grade}', '9.5') where id = 'zzt-dx-01'")
    assert review(db, "zzt-dx-01") == "revise"
    assert status(db, "zzt-dx-01") == [(1, "checked")]
    assert db.execute("select decision from reviews where lesson_id = 'zzt-dx-01'").fetchall() == [("revise",)]


def test_review_scores_must_be_1_to_5(db, export):
    do_import(db, export)
    with pytest.raises(psycopg.errors.CheckViolation):
        with db.transaction():
            review(db, "zzt-dx-01", acc=6)


def test_publish_makes_content_visible_and_publishes_dependents(db, export):
    do_import(db, export)
    assert db.execute("select count(*) from v_lessons where id like 'zzt-%'").fetchone()[0] == 0
    publish(db, "zzt-dx-01")
    assert status(db, "zzt-dx-01") == [(1, "published")]
    assert db.execute("select id from v_lessons where id like 'zzt-%'").fetchall() == [("zzt-dx-01",)]
    assert db.execute("select id from v_quiz_items where lesson_id like 'zzt-%'").fetchall() == [("zzt-dx-01-q1",)]
    assert db.execute("select id from v_topics where id like 'zzt-%'").fetchall() == [("zzt-dx",)]
    assert db.execute("select status::text from subtopics where id = 'zzt-criteria'").fetchone() == ("published",)
    assert db.execute("select status::text from subtopics where id = 'zzt-imaging'").fetchone() == ("draft",)


def test_publishing_version_2_archives_version_1_and_rollback_restores_it(db, export):
    do_import(db, export)
    publish(db, "zzt-dx-01")
    v2 = __import__("copy").deepcopy(export)
    v2["lessons"][0]["title"] = "Version two"
    do_import(db, v2)
    publish(db, "zzt-dx-01", 2)
    assert status(db, "zzt-dx-01") == [(1, "archived"), (2, "published")]
    assert db.execute("select title from v_lessons where id = 'zzt-dx-01'").fetchall() == [("Version two",)]

    assert db.execute("select rollback_lesson('zzt-dx-01')").fetchone()[0] == 1
    assert status(db, "zzt-dx-01") == [(1, "published"), (2, "archived")]
    assert db.execute("select title from v_lessons where id = 'zzt-dx-01'").fetchall() \
        == [("How doctors diagnose PsA",)]


def test_rollback_without_archived_version_fails(db, export):
    do_import(db, export)
    publish(db, "zzt-dx-01")
    with pytest.raises(psycopg.errors.RaiseException, match="no archived version"):
        with db.transaction():
            db.execute("select rollback_lesson('zzt-dx-01')")


def test_two_published_versions_are_blocked(db, export):
    do_import(db, export)
    publish(db, "zzt-dx-01")
    db.execute("insert into lessons (id, version, subtopic_id, sort_order, title, est_minutes, pages, "
               "key_takeaways, generated_by, checks, content_hash, status) "
               "select id, 2, subtopic_id, sort_order, title, est_minutes, pages, key_takeaways, generated_by, "
               "checks, 'other', 'checked' from lessons where id = 'zzt-dx-01' and version = 1")
    raises(db, psycopg.errors.UniqueViolation, "update lessons set status = 'published' where id = 'zzt-dx-01' and version = 2")


def test_integrity_checks_find_nothing_after_import(db, export):
    """The 'Database integrity' checks from the Week 9 plan §9, scoped to test content."""
    do_import(db, export)
    publish(db, "zzt-dx-01")
    checks = {
        "lessons without subtopic": "select count(*) from lessons l left join subtopics s on s.id = l.subtopic_id "
                                    "where l.id like 'zzt-%' and s.id is null",
        "claims without lesson": "select count(*) from lesson_claims c left join lessons l "
                                 "on l.id = c.lesson_id and l.version = c.lesson_version "
                                 "where c.lesson_id like 'zzt-%' and l.id is null",
        "quiz items without lesson": "select count(*) from quiz_items q left join lessons l "
                                     "on l.id = q.lesson_id and l.version = q.lesson_version "
                                     "where q.lesson_id like 'zzt-%' and l.id is null",
        "duplicate lesson sort_order in a subtopic": "select count(*) from (select subtopic_id, sort_order from lessons "
                                                     "where id like 'zzt-%' and version = 1 group by 1, 2 having count(*) > 1) d",
        "more than one published version": "select count(*) from (select id from lessons where id like 'zzt-%' "
                                           "and status = 'published' group by id having count(*) > 1) d",
        "lessons missing from a subtopic": "select count(*) from lessons where id like 'zzt-%' and subtopic_id is null",
    }
    assert {name: db.execute(sql).fetchone()[0] for name, sql in checks.items()} == {name: 0 for name in checks}

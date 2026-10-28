import copy
import json

import psycopg
import pytest

import publish as pub
from conftest import do_import

pytestmark = pytest.mark.db


def review(db, lesson_id, version=1):
    assert db.execute("select apply_review(%s,%s,'tester',5,5,5,5,5)", (lesson_id, version)).fetchone()[0] == "reviewed"


def states(db, lesson_id):
    return db.execute("select version, status::text from lessons where id = %s order by version",
                      (lesson_id,)).fetchall()


class Args:
    def __init__(self, **kw):
        self.lesson = self.version = self.rollback = None
        self.all_reviewed = self.dry_run = False
        self.__dict__.update(kw)


@pytest.fixture
def imported(db, export):
    do_import(db, export)
    return export


def test_resolve_unknown_lesson(db):
    with pytest.raises(pub.PublishError, match="no such lesson"):
        pub.resolve_targets(db, "zzt-dx-99", None)


def test_resolve_refuses_lessons_that_are_not_reviewed(db, imported):
    with pytest.raises(pub.PublishError, match=r"no reviewed version.*v1 checked"):
        pub.resolve_targets(db, "zzt-dx-01", None)
    with pytest.raises(pub.PublishError, match="only reviewed lessons can be published"):
        pub.resolve_targets(db, "zzt-dx-01", 1)
    with pytest.raises(pub.PublishError, match="no version 5"):
        pub.resolve_targets(db, "zzt-dx-01", 5)


def test_resolve_picks_the_latest_reviewed_version(db, imported):
    review(db, "zzt-dx-01")
    v2 = copy.deepcopy(imported)
    v2["lessons"][0]["title"] = "Version two"
    do_import(db, v2)
    review(db, "zzt-dx-01", 2)
    assert pub.resolve_targets(db, "zzt-dx-01", None) == [("zzt-dx-01", 2)]
    assert pub.resolve_targets(db, "zzt-dx-01", 1) == [("zzt-dx-01", 1)]
    mine = [t for t in pub.resolve_targets(db, None, None) if t[0].startswith("zzt-")]
    assert mine == [("zzt-dx-01", 2)]


def test_publish_reports_quiz_items_and_replaced_version(db, imported):
    review(db, "zzt-dx-01")
    [first] = pub.publish_lessons(db, [("zzt-dx-01", 1)])
    assert (first["version"], first["replaced_version"], first["quiz_items_published"]) == (1, None, 1)
    assert "reviewed -> published; 1 quiz items" in pub.format_result(first)

    v2 = copy.deepcopy(imported)
    v2["lessons"][0]["title"] = "Version two"
    do_import(db, v2)
    review(db, "zzt-dx-01", 2)
    [second] = pub.publish_lessons(db, [("zzt-dx-01", 2)])
    assert second["replaced_version"] == 1 and "v1 archived" in pub.format_result(second)
    assert states(db, "zzt-dx-01") == [(1, "archived"), (2, "published")]


def test_publishing_many_is_all_or_nothing(db, imported):
    review(db, "zzt-dx-01")
    with pytest.raises(psycopg.errors.RaiseException):
        pub.publish_lessons(db, [("zzt-dx-01", 1), ("zzt-dx-02", 1)])  # second one is only checked
    assert states(db, "zzt-dx-01") == [(1, "reviewed")]  # first publish was undone
    assert states(db, "zzt-dx-02") == [(1, "checked")]


def test_rollback_restores_previous_version(db, imported):
    review(db, "zzt-dx-01")
    pub.publish_lessons(db, [("zzt-dx-01", 1)])
    v2 = copy.deepcopy(imported)
    v2["lessons"][0]["title"] = "Version two"
    do_import(db, v2)
    review(db, "zzt-dx-01", 2)
    pub.publish_lessons(db, [("zzt-dx-01", 2)])

    result = pub.rollback_lesson(db, "zzt-dx-01")
    assert (result["version"], result["replaced_version"]) == (1, 2)
    assert "v2 archived, v1 published again" in pub.format_result(result)
    assert states(db, "zzt-dx-01") == [(1, "published"), (2, "archived")]


def test_rollback_errors(db, imported):
    with pytest.raises(pub.PublishError, match="no such lesson"):
        pub.rollback_lesson(db, "zzt-dx-99")
    review(db, "zzt-dx-01")
    pub.publish_lessons(db, [("zzt-dx-01", 1)])
    with pytest.raises(pub.PublishError, match="no archived version"):
        pub.rollback_lesson(db, "zzt-dx-01")
    assert states(db, "zzt-dx-01") == [(1, "published")]  # untouched by the failed rollback


def test_dry_run_changes_and_logs_nothing(db, imported, tmp_path):
    review(db, "zzt-dx-01")
    log = tmp_path / "logs" / "publish_log.jsonl"
    results = pub.run(db, Args(lesson="zzt-dx-01", dry_run=True), log)
    assert results[0]["version"] == 1
    assert states(db, "zzt-dx-01") == [(1, "reviewed")]
    assert not log.exists()


def test_real_run_publishes_and_appends_to_the_log(db, imported, tmp_path):
    review(db, "zzt-dx-01")
    log = tmp_path / "logs" / "publish_log.jsonl"
    pub.run(db, Args(lesson="zzt-dx-01"), log)
    assert states(db, "zzt-dx-01") == [(1, "published")]
    entry = json.loads(log.read_text(encoding="utf-8").splitlines()[0])
    assert (entry["action"], entry["lesson_id"], entry["version"]) == ("publish", "zzt-dx-01", 1)
    assert entry["by"] and entry["at"].endswith("Z")


def test_failed_run_leaves_no_log_entry(db, imported, tmp_path):
    log = tmp_path / "publish_log.jsonl"
    with pytest.raises(pub.PublishError):
        pub.run(db, Args(lesson="zzt-dx-01"), log)  # only checked
    assert not log.exists()


def test_cli_publish_and_dry_run(db, imported, tmp_path, run_script_on_test_db, capsys):
    run_script_on_test_db(pub)
    review(db, "zzt-dx-01")
    log = tmp_path / "log.jsonl"
    assert pub.main(["--lesson", "zzt-dx-01", "--dry-run"], log) == 0
    out = capsys.readouterr().out
    assert "reviewed -> published" in out and "dry run: nothing changed" in out
    assert states(db, "zzt-dx-01") == [(1, "reviewed")]

    assert pub.main(["--lesson", "zzt-dx-01"], log) == 0
    assert "1 change(s) logged" in capsys.readouterr().out
    assert states(db, "zzt-dx-01") == [(1, "published")]


def test_cli_error_exit_codes(db, imported, tmp_path, run_script_on_test_db, capsys):
    run_script_on_test_db(pub)
    assert pub.main(["--lesson", "zzt-dx-01"], tmp_path / "l.jsonl") == 1  # only checked
    err = capsys.readouterr().err
    assert "nothing changed" in err and "no reviewed version" in err
    assert pub.main(["--rollback", "zzt-dx-99"], tmp_path / "l.jsonl") == 1


def test_cli_argument_errors(capsys):
    with pytest.raises(SystemExit):
        pub.main([])  # one of the actions is required
    with pytest.raises(SystemExit):
        pub.main(["--lesson", "a", "--all-reviewed"])
    with pytest.raises(SystemExit):
        pub.main(["--all-reviewed", "--version", "2"])


def test_cli_needs_settings(monkeypatch, capsys):
    monkeypatch.setattr(pub, "load_settings", lambda start: {})
    assert pub.main(["--all-reviewed"]) == 2
    assert "SUPABASE_DB_URL" in capsys.readouterr().err

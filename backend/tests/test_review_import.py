import copy
import csv

import pytest

import review_import as rev
from conftest import do_import

HEADER = "lesson_id,version,accuracy,completeness,readability,safety,terminology,decision,comment\n"


def sheet(tmp_path, *lines, header=HEADER):
    path = tmp_path / "scores.csv"
    path.write_text(header + "".join(l + "\n" for l in lines), encoding="utf-8")
    return path


# --- reading scores (no database) -------------------------------------------

def test_reads_scored_rows_and_ignores_decision_and_extra_columns(tmp_path):
    path = sheet(tmp_path, "psa-dx-01,1,5,4,4,5,4,fail,Looks good",
                 header=HEADER.replace("comment", "comment,extra").rstrip("\n") + "\n")
    path.write_text(path.read_text(encoding="utf-8").replace("Looks good", "Looks good,x"), encoding="utf-8")
    scored, blank = rev.read_scores(path)
    assert blank == []
    assert scored == [{"lesson_id": "psa-dx-01", "version": 1, "accuracy": 5, "completeness": 4, "readability": 4,
                       "safety": 5, "terminology": 4, "comment": "Looks good"}]  # 'decision' is not used


def test_excel_bom_and_spaces_are_handled(tmp_path):
    path = tmp_path / "scores.csv"
    path.write_text(HEADER + " psa-dx-01 , 1 , 5, 5, 5, 5, 5,,\n", encoding="utf-8-sig")
    scored, _ = rev.read_scores(path)
    assert scored[0]["lesson_id"] == "psa-dx-01" and scored[0]["comment"] is None


def test_unscored_rows_are_skipped_not_errors(tmp_path):
    scored, blank = rev.read_scores(sheet(tmp_path, "psa-dx-01,1,,,,,,,", "psa-dx-02,1,5,5,5,5,5,,", ",,,,,,,,"))
    assert [s["lesson_id"] for s in scored] == ["psa-dx-02"] and blank == ["psa-dx-01"]


@pytest.mark.parametrize("line, message", [
    ("psa-dx-01,1,5,5,5,5,,,", "missing score"),
    ("psa-dx-01,1,6,5,5,5,5,,", "1-5"),
    ("psa-dx-01,1,0,5,5,5,5,,", "1-5"),
    ("psa-dx-01,1,4.5,5,5,5,5,,", "1-5"),
    ("psa-dx-01,1,abc,5,5,5,5,,", "1-5"),
    ("psa-dx-01,one,5,5,5,5,5,,", "version must be"),
    ("psa-dx-01,,5,5,5,5,5,,", "version must be"),
    (",1,5,5,5,5,5,,", "lesson_id is empty"),
])
def test_malformed_rows_reject_the_whole_file(tmp_path, line, message):
    path = sheet(tmp_path, "psa-dx-02,1,5,5,5,5,5,,", line)
    with pytest.raises(rev.SheetRejected, match=message):
        rev.read_scores(path)


def test_duplicate_rows_rejected(tmp_path):
    with pytest.raises(rev.SheetRejected, match="appears twice"):
        rev.read_scores(sheet(tmp_path, "psa-dx-01,1,5,5,5,5,5,,", "psa-dx-01,1,4,4,4,4,4,,"))
    scored, _ = rev.read_scores(sheet(tmp_path, "psa-dx-01,1,5,5,5,5,5,,", "psa-dx-01,2,4,4,4,4,4,,"))
    assert len(scored) == 2  # different versions are fine


def test_missing_columns_and_unreadable_file(tmp_path):
    with pytest.raises(rev.SheetRejected, match="missing column.*safety"):
        rev.read_scores(sheet(tmp_path, "a,1", header="lesson_id,version,accuracy\n"))
    with pytest.raises(rev.SheetRejected, match="cannot read"):
        rev.read_scores(tmp_path / "nope.csv")


def test_all_problems_are_listed_together(tmp_path):
    with pytest.raises(rev.SheetRejected) as e:
        rev.read_scores(sheet(tmp_path, "a,1,9,5,5,5,5,,", "b,x,5,5,5,5,5,,"))
    assert len(e.value.errors) == 2


# --- the sheet and the database ---------------------------------------------

mine = lambda rows: [r for r in rows if r["lesson_id"].startswith("zzt-")]


@pytest.fixture
def imported(db, export):
    do_import(db, export)  # zzt-dx-01 and zzt-dx-02 checked, zzt-dx-03 draft
    return export


@pytest.mark.db
def test_sheet_has_checked_lessons_only_with_their_evidence(db, imported):
    rows = mine(rev.make_sheet_rows(db))
    assert [r["lesson_id"] for r in rows] == ["zzt-dx-01", "zzt-dx-02"]  # the draft lesson is not offered
    first = rows[0]
    assert first["version"] == 1 and first["title"] == "How doctors diagnose PsA"
    assert "[page 1] There is no single test for PsA." in first["page_text"]
    assert "[page 2]" in first["page_text"]
    assert first["claims_with_quotes"].count("\n") == 3  # four claims
    assert "There is no single test that confirms psoriatic arthritis." in first["claims_with_quotes"]
    assert "Mock PsA One-Pager (test fixture) p.1" in first["claims_with_quotes"]
    assert first["fk_grade"] == 4.6 and first["flags"] == ""
    assert all(first[s] == "" for s in (*rev.SCORES, "decision", "comment"))


@pytest.mark.db
def test_reviewed_lessons_leave_the_sheet(db, imported):
    db.execute("select apply_review('zzt-dx-01',1,'t',5,5,5,5,5)")
    assert [r["lesson_id"] for r in mine(rev.make_sheet_rows(db))] == ["zzt-dx-02"]


@pytest.mark.db
def test_sheet_file_round_trips_and_is_not_overwritten(db, imported, tmp_path):
    rows = mine(rev.make_sheet_rows(db))
    path = tmp_path / "out" / "sheet.csv"
    rev.write_sheet(path, rows)
    with path.open(encoding="utf-8-sig", newline="") as f:
        back = list(csv.DictReader(f))
    assert list(back[0].keys()) == rev.SHEET_COLUMNS
    assert back[0]["page_text"] == rows[0]["page_text"] and back[0]["claims_with_quotes"] == rows[0]["claims_with_quotes"]
    scored, blank = rev.read_scores(path)  # an unfilled sheet imports as "nothing scored"
    assert scored == [] and "zzt-dx-01" in blank
    with pytest.raises(rev.SheetRejected, match="already exists"):
        rev.write_sheet(path, rows)


@pytest.mark.db
def test_apply_reviews_pass_revise_and_errors(db, imported):
    rows = [
        {"lesson_id": "zzt-dx-01", "version": 1, "accuracy": 5, "completeness": 5, "readability": 5, "safety": 5,
         "terminology": 5, "comment": "great"},
        {"lesson_id": "zzt-dx-02", "version": 1, "accuracy": 4, "completeness": 5, "readability": 5, "safety": 5,
         "terminology": 5, "comment": "define dactylitis earlier"},
        {"lesson_id": "zzt-dx-03", "version": 1, "accuracy": 5, "completeness": 5, "readability": 5, "safety": 5,
         "terminology": 5, "comment": None},
        {"lesson_id": "zzt-dx-99", "version": 1, "accuracy": 5, "completeness": 5, "readability": 5, "safety": 5,
         "terminology": 5, "comment": None},
    ]
    results = rev.apply_reviews(db, rows, "Dr. Test")
    assert [r["outcome"] for r in results] == ["reviewed", "revise", "error", "error"]
    assert "only checked lessons can be reviewed" in results[2]["error"]
    assert "not found" in results[3]["error"]
    status = dict(db.execute("select id, status::text from lessons where id like 'zzt-%'").fetchall())
    assert status == {"zzt-dx-01": "reviewed", "zzt-dx-02": "checked", "zzt-dx-03": "draft"}
    saved = db.execute("select lesson_id, reviewer, decision, comment from reviews where lesson_id like 'zzt-%' "
                       "order by lesson_id").fetchall()
    assert saved == [("zzt-dx-01", "Dr. Test", "pass", "great"),
                     ("zzt-dx-02", "Dr. Test", "revise", "define dactylitis earlier")]
    assert "send the comment back to the Data Lead" in rev.format_result(results[1])
    assert rev.format_result(results[3]).startswith("zzt-dx-99 v1: ERROR")


@pytest.mark.db
def test_sql_decides_not_the_sheet(db, imported, tmp_path):
    """A sheet that says 'pass' cannot override the SQL rule."""
    db.execute("update lessons set checks = jsonb_set(checks, '{fk_grade}', '9.5') where id = 'zzt-dx-01'")
    scored, _ = rev.read_scores(sheet(tmp_path, "zzt-dx-01,1,5,5,5,5,5,pass,"))
    assert rev.apply_reviews(db, scored, "t")[0]["outcome"] == "revise"


@pytest.mark.db
def test_a_second_review_after_revise_is_allowed(db, imported):
    low = {"lesson_id": "zzt-dx-01", "version": 1, "accuracy": 3, "completeness": 5, "readability": 5, "safety": 5,
           "terminology": 5, "comment": None}
    assert rev.apply_reviews(db, [low], "t")[0]["outcome"] == "revise"
    assert rev.apply_reviews(db, [{**low, "accuracy": 5}], "t")[0]["outcome"] == "reviewed"
    assert db.execute("select count(*) from reviews where lesson_id = 'zzt-dx-01'").fetchone()[0] == 2


# --- command line -----------------------------------------------------------

@pytest.mark.db
def test_cli_make_sheet(db, imported, tmp_path, run_script_on_test_db, capsys):
    run_script_on_test_db(rev)
    out = tmp_path / "sheet.csv"
    assert rev.main(["--make-sheet", str(out)]) == 0
    assert "zzt-dx-01" in capsys.readouterr().out and out.is_file()
    assert rev.main(["--make-sheet", str(out)]) == 1  # refuses to overwrite
    assert "already exists" in capsys.readouterr().err


@pytest.mark.db
def test_cli_import_dry_run_then_real(db, imported, tmp_path, run_script_on_test_db, capsys):
    run_script_on_test_db(rev)
    path = sheet(tmp_path, "zzt-dx-01,1,5,5,5,5,5,,ok", "zzt-dx-02,1,5,3,5,5,5,,too thin", "zzt-dx-03,1,,,,,,,")
    assert rev.main([str(path), "--reviewer", "Dr. Test", "--dry-run"]) == 0
    out = capsys.readouterr().out
    assert "zzt-dx-01 v1: reviewed" in out and "zzt-dx-02 v1: revise" in out and "zzt-dx-03: not scored yet" in out
    assert "dry run (nothing changed)" in out
    assert db.execute("select status::text from lessons where id = 'zzt-dx-01'").fetchone() == ("checked",)
    assert db.execute("select count(*) from reviews where lesson_id like 'zzt-%'").fetchone()[0] == 0

    assert rev.main([str(path), "--reviewer", "Dr. Test"]) == 0
    assert db.execute("select status::text from lessons where id = 'zzt-dx-01'").fetchone() == ("reviewed",)
    assert db.execute("select count(*) from reviews where lesson_id like 'zzt-%'").fetchone()[0] == 2


@pytest.mark.db
def test_cli_reports_row_errors_with_exit_1_but_applies_the_rest(db, imported, tmp_path, run_script_on_test_db, capsys):
    run_script_on_test_db(rev)
    path = sheet(tmp_path, "zzt-dx-03,1,5,5,5,5,5,,", "zzt-dx-01,1,5,5,5,5,5,,")
    assert rev.main([str(path), "--reviewer", "t"]) == 1
    assert "zzt-dx-03 v1: ERROR" in capsys.readouterr().out
    assert db.execute("select status::text from lessons where id = 'zzt-dx-01'").fetchone() == ("reviewed",)


@pytest.mark.db
def test_cli_rejects_a_bad_sheet_without_touching_the_database(db, imported, tmp_path, run_script_on_test_db, capsys):
    run_script_on_test_db(rev)
    path = sheet(tmp_path, "zzt-dx-01,1,5,5,5,5,5,,", "zzt-dx-02,1,9,5,5,5,5,,")
    assert rev.main([str(path), "--reviewer", "t"]) == 1
    assert "file rejected" in capsys.readouterr().err
    assert db.execute("select count(*) from reviews where lesson_id like 'zzt-%'").fetchone()[0] == 0


def test_cli_argument_and_settings_errors(tmp_path, monkeypatch, capsys):
    with pytest.raises(SystemExit):
        rev.main([])
    with pytest.raises(SystemExit):
        rev.main(["a.csv", "--make-sheet", "b.csv"])
    with pytest.raises(SystemExit):
        rev.main([str(sheet(tmp_path, "a,1,5,5,5,5,5,,"))])  # no --reviewer
    monkeypatch.setattr(rev, "load_settings", lambda start: {})
    assert rev.main([str(sheet(tmp_path, "a,1,5,5,5,5,5,,")), "--reviewer", "t"]) == 2
    assert "SUPABASE_DB_URL" in capsys.readouterr().err

import copy
import json

from rheumnotes_data.legacy import convert, parse_source_string
from rheumnotes_data.paths import REPO_ROOT
from rheumnotes_data.validate import validate_bundle

FIXTURE = REPO_ROOT / "shared" / "fixtures" / "test_bundle.json"


def test_legacy_content_is_valid():
    report = validate_bundle(convert())
    assert report.ok, report.summary()


def test_fixture_is_valid():
    report = validate_bundle(json.loads(FIXTURE.read_text()), media_dir=None)
    assert report.ok, report.summary()


def test_parse_page_ranges():
    assert parse_source_string("A p.2; B pp.9, 12-13") == [("A", [2]), ("B", [9, 12, 13])]


def test_broken_relationships_are_reported():
    bundle = json.loads(FIXTURE.read_text())
    broken = copy.deepcopy(bundle)
    broken["lessons"][0]["subtopic_id"] = "nope"
    broken["lessons"][1]["source_refs"][0]["source_id"] = "missing-source"
    errors = validate_bundle(broken, media_dir=None).structure_errors
    assert any("nope" in e for e in errors)
    assert any("missing-source" in e for e in errors)


def test_lesson_without_sources_fails_schema():
    bundle = json.loads(FIXTURE.read_text())
    bundle["lessons"][0]["source_refs"] = []
    assert validate_bundle(bundle, media_dir=None).schema_errors


def test_reviewed_status_cannot_be_exported():
    bundle = json.loads(FIXTURE.read_text())
    bundle["lessons"][0]["status"] = "reviewed"
    assert validate_bundle(bundle, media_dir=None).schema_errors

import json
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "scripts"))

import convert_repo_content as conv  # noqa: E402
import import_content as imp  # noqa: E402
import make_demo_export as demo  # noqa: E402

SCHEMA_PATH = conv.find_upwards(BACKEND, "schema/content.schema.json")
TOPICS = conv.find_upwards(BACKEND, "topics.yaml")

pytestmark = pytest.mark.skipif(SCHEMA_PATH is None, reason="schema not found")


@pytest.fixture(scope="module")
def schema():
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def ids(data):
    return {
        "lessons": {l["id"] for l in data["lessons"]},
        "topics": {t["id"] for t in data["topics"]},
        "subtopics": {s["id"] for t in data["topics"] for s in t["subtopics"]},
        "sources": {s["id"] for s in data["sources"]},
        "media": {m["id"] for m in data["media"]},
        "quizzes": {q["id"] for q in data["quizzes"]},
        "topic_orders": {t["order"] for t in data["topics"]},
    }


def test_demo_export_is_valid_and_keeps_the_gate_outcomes(schema):
    data = demo.build_demo()
    assert conv.validate_export(data, schema) == []
    status = {l["id"]: l["status"] for l in data["lessons"]}
    assert status == {"psa-demo-01": "checked", "psa-demo-02": "checked", "psa-demo-03": "draft"}
    for lesson in data["lessons"]:
        assert imp.effective_status(lesson)[0] == lesson["status"]  # checked ones still pass the gate


def test_demo_is_clearly_marked_as_invented():
    data = demo.build_demo()
    assert "Demo" in data["topics"][0]["name"]
    assert "invented" in data["sources"][0]["title"]
    assert data["run"]["run_id"].startswith("demo-")


def test_no_old_mock_ids_remain():
    text = json.dumps(demo.build_demo())
    for old in ("psa-dx-", "dx-criteria", "dx-imaging", "src-mock", "mock-joints\"", "2026-10-28-mock"):
        assert old not in text


@pytest.mark.skipif(TOPICS is None, reason="repo content not found")
def test_demo_does_not_collide_with_real_content():
    real = ids(conv.convert(TOPICS.parent, "2026-10-28T15:00:00Z"))
    mine = ids(demo.build_demo())
    for kind in real:
        assert real[kind].isdisjoint(mine[kind]), kind


def test_demo_imports_cleanly_in_a_dry_run(tmp_path, capsys):
    out = tmp_path / "demo.json"
    assert demo.main(["--out", str(out)]) == 0
    assert imp.main([str(out), "--media-dir", str(demo.MOCK.parent), "--dry-run"]) == 0
    assert "inserted 3" in capsys.readouterr().out


def test_fixture_drift_is_reported(tmp_path, monkeypatch):
    changed = tmp_path / "mock.json"
    changed.write_text(demo.MOCK.read_text(encoding="utf-8").replace("src-mock-onepager", "x"), encoding="utf-8")
    with pytest.raises(ValueError, match="fixture changed"):
        demo.build_demo(changed)

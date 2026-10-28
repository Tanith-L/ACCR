import json
import re
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
RESPONSES = BACKEND / "fixtures" / "mock_responses"
CONTRACT = BACKEND / "docs" / "api-contract.md"

# Columns of the app-facing views (migration 0002_published_access.sql).
TOPIC_KEYS = {"id", "name", "icon", "sort_order"}  # the select= in the contract
LESSON_KEYS = {"id", "version", "subtopic_id", "sort_order", "title", "est_minutes", "pages",
               "key_takeaways", "images", "updated_at"}
IMAGE_KEYS = {"media_id", "page", "path", "alt_text", "credit"}
QUIZ_KEYS = {"id", "lesson_id", "question", "options", "answer", "feedback"}
PATH_SUBTOPIC_KEYS = {"id", "name", "sort_order", "lessons"}
PATH_LESSON_KEYS = {"id", "title", "est_minutes", "sort_order"}
PUBLISHED = ["psa-dx-01", "psa-dx-02"]  # psa-dx-03 is a draft in the mock export


def load(name):
    return json.loads((RESPONSES / name).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def mock():
    return json.loads((BACKEND / "fixtures" / "mock_export.json").read_text(encoding="utf-8"))


def test_every_response_file_is_valid_json():
    files = list(RESPONSES.glob("*.json"))
    assert len(files) >= 9
    for f in files:
        json.loads(f.read_text(encoding="utf-8"))


def test_topics(mock):
    topics = load("topics.json")
    assert [set(t) for t in topics] == [TOPIC_KEYS]
    assert [t["sort_order"] for t in topics] == sorted(t["sort_order"] for t in topics)
    src = mock["topics"][0]
    assert topics == [{"id": src["id"], "name": src["name"], "icon": src["icon"], "sort_order": src["order"]}]


def test_learning_path_only_has_published_lessons_in_order(mock):
    path = load("learning_path_dx.json")
    assert all(set(s) == PATH_SUBTOPIC_KEYS for s in path)
    assert [s["sort_order"] for s in path] == sorted(s["sort_order"] for s in path)
    shown = [l["id"] for s in path for l in s["lessons"]]
    assert shown == PUBLISHED
    assert "psa-dx-03" not in shown
    assert "dx-imaging" not in [s["id"] for s in path]  # no published lessons, so no subtopic
    for s in path:
        assert s["lessons"] and all(set(l) == PATH_LESSON_KEYS for l in s["lessons"])
        assert [l["sort_order"] for l in s["lessons"]] == sorted(l["sort_order"] for l in s["lessons"])
    lessons = {l["id"]: l for l in mock["lessons"]}
    for s in path:
        for l in s["lessons"]:
            assert (l["title"], l["est_minutes"]) == (lessons[l["id"]]["title"], lessons[l["id"]]["est_minutes"])


@pytest.mark.parametrize("lesson_id", PUBLISHED)
def test_lesson_matches_export(mock, lesson_id):
    resp = load(f"lesson_{lesson_id}.json")
    assert len(resp) == 1
    row, src = resp[0], next(l for l in mock["lessons"] if l["id"] == lesson_id)
    assert set(row) == LESSON_KEYS
    assert row["subtopic_id"] == src["subtopic_id"]
    for k in ("title", "est_minutes", "pages", "key_takeaways"):
        assert row[k] == src[k]
    assert 1 <= len(row["pages"]) <= 4 and 1 <= len(row["key_takeaways"]) <= 3
    assert [p["order"] for p in row["pages"]] == list(range(1, len(row["pages"]) + 1))
    assert re.match(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d", row["updated_at"])
    media = {m["id"]: m for m in mock["media"]}
    assert [i["media_id"] for i in row["images"]] == [i["media_id"] for i in src.get("images", [])]
    for img in row["images"]:
        assert set(img) == IMAGE_KEYS
        assert img["path"] == media[img["media_id"]]["file"]
        assert (img["alt_text"], img["credit"]) == (media[img["media_id"]]["alt_text"], media[img["media_id"]]["credit"])
        assert img["page"] <= len(row["pages"])


def test_lesson_sort_order_matches_path():
    path_orders = {l["id"]: l["sort_order"] for s in load("learning_path_dx.json") for l in s["lessons"]}
    for lesson_id in PUBLISHED:
        assert load(f"lesson_{lesson_id}.json")[0]["sort_order"] == path_orders[lesson_id]


@pytest.mark.parametrize("lesson_id", PUBLISHED)
def test_quiz_matches_export(mock, lesson_id):
    resp = load(f"quiz_{lesson_id}.json")
    src = {q["id"]: q for q in mock["quizzes"] if q["lesson_id"] == lesson_id}
    assert resp and {q["id"] for q in resp} == set(src)
    for q in resp:
        assert set(q) == QUIZ_KEYS
        assert q == {k: src[q["id"]][k] for k in QUIZ_KEYS}
        assert 2 <= len(q["options"]) <= 4 and 0 <= q["answer"] < len(q["options"])


def test_no_response_exposes_draft_or_internal_fields():
    text = "".join(f.read_text(encoding="utf-8") for f in RESPONSES.glob("*.json"))
    assert "psa-dx-03" not in text
    for internal in ("claims", "source_quote", "checks", "content_hash", "status", "generated_by", "file_hash"):
        assert f'"{internal}"' not in text


def test_empty_and_error_responses():
    assert load("empty.json") == []
    assert {"code", "message"} <= set(load("error_400.json"))
    assert {"message", "hint"} <= set(load("error_401.json"))


# --- docs/api-contract.md ---------------------------------------------------

def test_contract_lists_every_endpoint_and_mock_file():
    doc = CONTRACT.read_text(encoding="utf-8")
    for endpoint in ("/v_topics?select=id,name,icon,sort_order&order=sort_order", "/rpc/get_learning_path",
                     "/v_lessons?id=eq.", "/v_quiz_items?lesson_id=eq.", "/storage/v1/object/public/media/"):
        assert endpoint in doc
    for name in re.findall(r"`([\w.-]+\.json)`", doc):
        assert (RESPONSES / name).is_file(), f"contract mentions {name} but the file is missing"
    for status in ("200", "400", "401"):
        assert status in doc


def test_contract_mentions_every_response_field():
    doc = CONTRACT.read_text(encoding="utf-8")
    for field in LESSON_KEYS | IMAGE_KEYS | QUIZ_KEYS | PATH_SUBTOPIC_KEYS | PATH_LESSON_KEYS | TOPIC_KEYS:
        assert field in doc, field

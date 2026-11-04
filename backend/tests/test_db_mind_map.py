"""get_mind_map (migration 0007): the published hierarchy as a flat list of nodes.
The migration is applied inside each test's rolled-back transaction, so these tests pass
whether or not 0007 has been deployed to the project, and they never change it."""
from pathlib import Path

import pytest

from conftest import do_import, publish

pytestmark = pytest.mark.db

MIGRATION = Path(__file__).resolve().parents[1] / "supabase" / "migrations" / "0007_mind_map.sql"
NODE_KEYS = {"id", "parent_id", "kind", "label", "sort_order", "lesson_id"}
DEPTH = {"root": 0, "topic": 1, "subtopic": 2, "lesson": 3}


@pytest.fixture
def imported(db, export):
    db.execute(MIGRATION.read_text(encoding="utf-8"))
    do_import(db, export)  # zzt-dx-01/02 checked, zzt-dx-03 draft; nothing published yet
    return db


def mind_map(db, disease="zzt"):
    return db.execute("select get_mind_map(%s)", (disease,)).fetchone()[0]


def test_nothing_published_returns_empty_list(imported):
    assert mind_map(imported) == []


def test_unknown_disease_returns_empty_list(imported):
    publish(imported, "zzt-dx-01")
    assert mind_map(imported, "no-such-disease") == []


def test_published_lesson_builds_the_branch_down_to_it(imported):
    publish(imported, "zzt-dx-01")
    assert [(n["id"], n["parent_id"], n["kind"]) for n in mind_map(imported)] == [
        ("root", None, "root"),
        ("topic:zzt-dx", "root", "topic"),
        ("subtopic:zzt-criteria", "topic:zzt-dx", "subtopic"),
        ("lesson:zzt-dx-01", "subtopic:zzt-criteria", "lesson"),
    ]


def test_drafts_and_empty_subtopics_are_left_out(imported):
    publish(imported, "zzt-dx-01")
    ids = {n["id"] for n in mind_map(imported)}
    assert "lesson:zzt-dx-02" not in ids and "lesson:zzt-dx-03" not in ids  # checked / draft
    assert "subtopic:zzt-imaging" not in ids  # its only lesson is a draft


def test_node_shape_and_labels(imported):
    publish(imported, "zzt-dx-01")
    nodes = {n["id"]: n for n in mind_map(imported)}
    assert all(set(n) == NODE_KEYS for n in nodes.values())
    assert nodes["root"]["label"] == "Psoriatic arthritis"
    lesson = nodes["lesson:zzt-dx-01"]
    assert lesson["lesson_id"] == "zzt-dx-01"
    assert lesson["label"] == imported.execute(
        "select title from lessons where id = 'zzt-dx-01'").fetchone()[0]
    assert all(n["lesson_id"] is None for n in nodes.values() if n["kind"] != "lesson")


def test_tree_is_well_formed_and_ordered(imported):
    publish(imported, "zzt-dx-01")
    publish(imported, "zzt-dx-02")
    nodes = mind_map(imported)
    ids = [n["id"] for n in nodes]
    assert len(ids) == len(set(ids))
    assert [n["kind"] for n in nodes].count("root") == 1
    for n in nodes:
        assert n["parent_id"] is None or n["parent_id"] in ids  # every parent exists
        parent = next((p for p in nodes if p["id"] == n["parent_id"]), None)
        assert parent is None or DEPTH[parent["kind"]] == DEPTH[n["kind"]] - 1
    # Parents come before children, and siblings are in sort_order.
    assert [DEPTH[n["kind"]] for n in nodes] == sorted(DEPTH[n["kind"]] for n in nodes)
    lessons = [n for n in nodes if n["kind"] == "lesson"]
    assert [n["id"] for n in lessons] == ["lesson:zzt-dx-01", "lesson:zzt-dx-02"]
    assert [n["sort_order"] for n in lessons] == sorted(n["sort_order"] for n in lessons)


def test_anon_can_call_it_and_sees_published_nodes_only(imported):
    publish(imported, "zzt-dx-01")
    imported.execute("set local role anon")
    try:
        nodes = mind_map(imported)
    finally:
        imported.execute("reset role")
    assert [n["id"] for n in nodes if n["kind"] == "lesson"] == ["lesson:zzt-dx-01"]

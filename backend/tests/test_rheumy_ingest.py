"""Passages for the Rheumy chatbot (scripts/rheumy_ingest.py). No database or network."""
import json
from pathlib import Path

import pytest

import rheumy_ingest as ri

ROOT = Path(__file__).resolve().parents[2]


def test_split_respects_limits_and_keeps_all_text():
    text = "\n\n".join(f"Paragraph {i}. " + "word " * 60 for i in range(30))
    passages = ri.split_passages(text)
    assert len(passages) > 3
    assert all(len(p) <= ri.MAX_CHARS + ri.OVERLAP_CHARS + 2 for p in passages)
    for i in range(30):
        assert any(f"Paragraph {i}." in p for p in passages)


def test_split_breaks_one_huge_paragraph_on_sentences_and_words():
    sentence_text = " ".join(f"Sentence number {i} is here." for i in range(400))
    no_punctuation = "x" * 50 + " " + "y" * 4000
    for text in (sentence_text, no_punctuation):
        passages = ri.split_passages(text)
        assert all(len(p) <= ri.MAX_CHARS + ri.OVERLAP_CHARS + 2 for p in passages)


def test_reference_markers_are_removed():
    assert ri.split_passages("Bursitis causes pain. [29]\n\n[paragraph 42] Next part [3, 4].") == [
        "Bursitis causes pain.\n\nNext part ."
    ]


@pytest.fixture(scope="module")
def chunks():
    return ri.build_chunks(ROOT)


def test_every_lesson_and_listed_source_is_included(chunks):
    library = json.loads((ROOT / ri.LIBRARY).read_text(encoding="utf-8"))
    lesson_ids = {c["source_id"] for c in chunks if c["kind"] == "lesson"}
    assert lesson_ids == {l["id"] for l in library["lessons"]}
    assert {c["source_id"] for c in chunks if c["kind"] == "source"} == {s for s, _ in ri.SOURCES}


def test_background_and_design_documents_are_left_out(chunks):
    sources = {c["source_id"] for c in chunks}
    assert not any("top-autoimmune" in s or s == "src-rheumnotes" or "mindmap" in s for s in sources)


def test_ids_are_stable_unique_and_content_hashed(chunks):
    again = ri.build_chunks(ROOT)
    assert [c["id"] for c in chunks] == [c["id"] for c in again]
    assert len({c["id"] for c in chunks}) == len(chunks)
    assert all(len(c["content_sha256"]) == 64 for c in chunks)
    first = next(c for c in chunks if c["kind"] == "lesson")
    assert first["locator"].startswith("Page ") and first["lesson_status"]


def test_key_takeaways_get_their_own_passage(chunks):
    takeaways = [c for c in chunks if c["locator"] == "Key takeaways"]
    assert len(takeaways) == 24
    assert all(c["content"].startswith("Key takeaways:\n- ") for c in takeaways)


def test_dry_run_sends_nothing(capsys, monkeypatch):
    monkeypatch.setattr(ri, "post", lambda *a, **k: pytest.fail("dry run must not send"))
    assert ri.main(["--dry-run", "--root", str(ROOT)]) == 0
    out = capsys.readouterr().out
    assert "from 24 lessons" in out and "dry run: nothing sent" in out


def test_missing_settings_fail_loudly(capsys, monkeypatch, tmp_path):
    monkeypatch.setattr(ri, "load_settings", lambda start: {})
    assert ri.main(["--root", str(ROOT)]) == 2
    assert "SUPABASE_URL, SUPABASE_SERVICE_KEY" in capsys.readouterr().err

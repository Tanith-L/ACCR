import csv
import json
import re

import pytest

import make_review_page as page
import review_import as rev

PROVENANCE = [{"kind": "provenance",
               "references": [{"id": "r", "title": "NIAMS: Diagnosis", "url": "https://example.org/niams"}],
               "source_usage": [
                   {"source_id": "src-a", "pages": [1, 2], "kind": "text", "locator": "Box A (left)",
                    "contribution": "Explains CASPAR.", "limits": "Rows obscured."},
                   {"source_id": "src-b", "pages": [2], "kind": "image", "locator": "Right branch",
                    "contribution": "Feature groups.", "limits": "Typo in heading."}]}]
VIDEO = {"scenes": [{"name": "Welcome", "lines": [{"source": "framing", "text": "Hi there."}]},
                    {"name": "Checks", "lines": [{"source": "nhs-psa", "text": "See a doctor."},
                                                 {"source": "lesson-text", "text": "Ask early."}]}]}
IMAGES = [{"page": 1, "alt_text": "A hand", "credit": "Lyra. Source: https://x.org/a", "path": "hand.jpg"},
          {"page": 2, "alt_text": "A knee", "credit": "NIH", "path": "knee.png"}]


def sheet_row(lesson_id="psa-x-01", **over):
    row = {
        "lesson_id": lesson_id, "version": "1", "title": "A </script> title",
        "page_text": "[page 1] First page.\n\n[page 2] Second page,\nwith a line break.",
        "images": rev.format_images(IMAGES, "https://p.supabase.co"),
        "video_script": rev.format_video_script(VIDEO),
        "sources": rev.format_sources(PROVENANCE, {"src-a": "PsA One-Pager"}),
        "fk_grade": "7.2", "flags": "", **{s: "" for s in rev.SCORES}, "decision": "", "comment": "",
    }
    row.update(over)
    return row


def test_to_lesson_parses_every_section():
    lesson = page.to_lesson(sheet_row())
    assert [p["n"] for p in lesson["pages"]] == [1, 2] and "line break" in lesson["pages"][1]["body"]
    assert lesson["images"][0]["url"].endswith("/media/hand.jpg") and lesson["images"][1]["page"] == 2
    assert lesson["images"][0]["credit"] == "Lyra. Source: https://x.org/a"
    assert [s["name"] for s in lesson["video"]] == ["Welcome", "Checks"] and len(lesson["video"][1]["lines"]) == 2
    assert [s["title"] for s in lesson["sources"]] == ["PsA One-Pager", "src-b"]
    assert lesson["sources"][0]["pages"] == "1, 2" and lesson["sources"][0]["where"] == "Box A (left)"
    assert lesson["references"] == [{"title": "NIAMS: Diagnosis", "url": "https://example.org/niams"}]
    assert lesson["fk_grade"] == 7.2 and lesson["flags"] == []


def test_lessons_without_images_video_or_sources_still_parse():
    lesson = page.to_lesson(sheet_row(images="", video_script="", sources="", flags="a; b", fk_grade=""))
    assert lesson["images"] == lesson["video"] == lesson["sources"] == lesson["references"] == []
    assert lesson["flags"] == ["a", "b"] and lesson["fk_grade"] is None


def test_unreadable_text_fails_loudly_instead_of_dropping_a_section():
    with pytest.raises(page.PageError, match="images did not parse"):
        page.to_lesson(sheet_row(images="A picture with no structure"))
    with pytest.raises(page.PageError, match="video script"):
        page.to_lesson(sheet_row(video_script="Scene 1: Welcome\nnot a bullet"))


def test_page_embeds_data_safely_and_is_deterministic():
    html = page.build_page([sheet_row(), sheet_row("psa-x-02")], generated="2026-01-02")
    blob = re.search(r'<script id="data" type="application/json">(.*?)</script>', html, re.S).group(1)
    data = json.loads(blob)
    assert [l["id"] for l in data["lessons"]] == ["psa-x-01", "psa-x-02"]
    assert data["lessons"][0]["title"] == "A </script> title"  # round-trips; cannot end the script tag early
    assert page.build_page([sheet_row(), sheet_row("psa-x-02")], generated="2026-01-02") == html
    assert "__DATA__" not in html


def test_cli_writes_the_page_and_refuses_to_overwrite(tmp_path, capsys):
    sheet = tmp_path / "sheet.csv"
    with sheet.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=rev.SHEET_COLUMNS)
        w.writeheader()
        w.writerow(sheet_row())
    out = tmp_path / "out" / "review.html"
    assert page.main([str(sheet), str(out)]) == 0 and "1 lessons" in capsys.readouterr().out
    assert "RheumNotes PsA" in out.read_text(encoding="utf-8")
    assert page.main([str(sheet), str(out)]) == 1 and "already exists" in capsys.readouterr().err
    assert page.main([str(sheet), str(out), "--overwrite"]) == 0


def test_cli_rejects_a_sheet_with_missing_columns(tmp_path, capsys):
    sheet = tmp_path / "old.csv"
    sheet.write_text("lesson_id,version,title\nx,1,T\n", encoding="utf-8")
    assert page.main([str(sheet), str(tmp_path / "o.html")]) == 1
    assert "missing column" in capsys.readouterr().err


def test_the_scores_file_the_page_downloads_imports(tmp_path):
    # Same columns and quoting the page writes (see download() in review_page_template.html).
    path = tmp_path / "scores.csv"
    path.write_text(
        "﻿lesson_id,version,title,accuracy,completeness,readability,safety,terminology,decision,comment,reviewer\r\n"
        'psa-x-01,1,A title,5,4,4,5,4,,"Clear, good.",Dr. Murphy\r\n'
        "psa-x-02,1,Another,,,,,,,,Dr. Murphy\r\n", encoding="utf-8")
    scored, blank = rev.read_scores(path)
    assert scored == [{"lesson_id": "psa-x-01", "version": 1, "accuracy": 5, "completeness": 4, "readability": 4,
                       "safety": 5, "terminology": 4, "comment": "Clear, good."}]
    assert blank == ["psa-x-02"]

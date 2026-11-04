"""Build all registered PsA lesson DRAFTS and topic image maps without live services.

Bibliographic references are supplied for review; this drafting stage does not
invent per-claim verification or clinical approval. The assessed Week 9 sample
keeps its separate, stricter source-quote validation workflow.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sys

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline.content_processing import init_readability, readability
from convert_repo_content import validate_export
from import_content import media_errors
from pipeline.library_preview import render_preview
from pipeline.source_correspondence import validate_correspondence, review_documents, lesson_source_rows

INPUT = ROOT / "data/psa/assisted-input/all-topics.json"
MAPS = ROOT / "data/psa/assisted-input/image-maps.json"
OUT = ROOT / "data/psa/chapter"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def build():
    source = read(INPUT)
    navigation = read(MAPS)
    maps = navigation["topics"]
    course_map = navigation.get("course_map")
    taxonomy = yaml.safe_load((ROOT / "topics.yaml").read_text(encoding="utf-8"))
    registry = {s["id"]: s for s in read(ROOT / "data/psa/source-inventory.json")}
    registry.update({s["id"]: s for s in source.get("supplemental_sources", [])})
    validate_correspondence(ROOT, source, registry)
    ordered = [(t, s, lid) for t in taxonomy["topics"] for s in t["subtopics"] for lid in s["lessons"]]
    if [l["id"] for l in source["lessons"]] != [lid for _, _, lid in ordered]:
        raise ValueError("Draft IDs/order must cover every registered lesson exactly once")
    if set(maps) != {"symptoms"}:
        raise ValueError("Symptoms has a lesson map; the course map links to all topics")
    if course_map and [h["topic_id"] for h in course_map["hotspots"]] != [t["id"] for t in taxonomy["topics"]]:
        raise ValueError("Course map must reach every topic once in course order")
    media = source["media"]
    used_media = {m["media_id"] for m in maps.values()}
    if course_map:
        used_media.add(course_map["media_id"])
    used_media |= {i["media_id"] for l in source["lessons"] for i in l.get("images", [])}
    if {m["id"] for m in media} != used_media:
        raise ValueError("Media must match the active topic maps")
    used = {sid for l in source["lessons"] for sid in l["source_ids"]} | {m["source_id"] for m in media}
    sources = []
    for sid in sorted(used):
        record = registry[sid]
        raw = (ROOT / record["local_file"]).read_bytes()
        if sha(raw) != record["file_hash"]:
            raise ValueError(f"Original source hash changed: {sid}")
        sources.append({**{k: record[k] for k in ("id", "title", "type", "file_hash")},
                        "provided_by": record.get("provided_by", "Supplied ACCR educational reference library; clinical approval not recorded")})
    topics = []
    for t in taxonomy["topics"]:
        topic = {k: t[k] for k in ("id", "name", "order")}
        topic["subtopics"] = [{**{k: s[k] for k in ("id", "name", "order")}, "lesson_ids": s["lessons"]}
                              for s in t["subtopics"]]
        if t["id"] in maps:
            topic["image_map"] = maps[t["id"]]
        topics.append(topic)
    init_readability()
    lessons, scores = [], {}
    for draft, (topic, subtopic, lid) in zip(source["lessons"], ordered, strict=True):
        for key in draft["references"]:
            if key not in source["references"]:
                raise ValueError(f"Unknown bibliographic reference: {key}")
        lesson = {"id": lid, "topic_id": topic["id"], "subtopic_id": subtopic["id"],
                  "title": draft["title"],
                  "est_minutes": max(1, min(5, math.ceil(sum(len(p.split()) for p in draft["pages"]) / 150))),
                  "pages": [{"order": n, "body": p} for n, p in enumerate(draft["pages"], 1)],
                  "key_takeaways": draft["key_takeaways"], "claims": [],
                  "checks": {"schema_valid": True, "coverage": None,
                             "safety_flags": ["Per-claim source verification and clinical review pending"]},
                  "generated_by": "llm", "status": "draft"}
        if not all(t in draft["pages"][0] or t in draft["pages"][1] for t in draft["key_takeaways"]):
            raise ValueError(f"Takeaway is not in lesson text: {lid}")
        if draft.get("images"):
            lesson["images"] = draft["images"]
        scores[lid] = readability(lesson, [])
        lesson["checks"]["fk_grade"] = max(s["fk_grade"] for s in scores[lid])
        if lesson["checks"]["fk_grade"] >= 8:
            raise ValueError(f"{lid}: reading level must be below US grade 8")
        lessons.append(lesson)
    stamp = datetime.now(timezone.utc)
    data = {"schema_version": "1.2", "run": {"run_id": stamp.strftime("psa-%Y%m%d-%H%M%S-complete-drafts"),
            "model": "Codex interactive assistant; no independent judge", "prompt_version": "psa-all-topics-v4-optional-maps",
            "generated_at": stamp.isoformat()}, "disease": taxonomy["disease"], "sources": sources,
            "topics": topics, "lessons": lessons, "quizzes": [], "media": media}
    if course_map:
        data["course_map"] = course_map
    errors = validate_export(data, read(ROOT / "schema/content.schema.json")) + media_errors(data, OUT)
    if errors:
        raise ValueError("\n".join(errors))
    for t in topics:
        if "image_map" in t:
            targets = {h["lesson_id"] for h in t["image_map"]["hotspots"]}
            expected = {l["id"] for l in lessons if l["topic_id"] == t["id"]}
            if targets != expected:
                raise ValueError(f"Map must reach every lesson in topic {t['id']}")
    return data, source, scores


def documents(data, authored, scores):
    parts = yaml.safe_load((ROOT / "data/psa/organization.yaml").read_text(encoding="utf-8"))["parts"]
    folders = {p["topic_id"]: p["folder"] for p in parts}
    registry = {s["id"]: s for s in read(ROOT / "data/psa/source-inventory.json")}
    registry.update({s["id"]: s for s in authored.get("supplemental_sources", [])})
    drafts = {s["id"]: s for s in authored["lessons"]}
    docs = {}
    map_counts = {t["id"]: len(t["image_map"]["hotspots"]) for t in data["topics"] if "image_map" in t}
    lines = ["# Complete PsA lesson drafts", "", f"Six topics, {len(data['lessons'])} lessons. Home and five topics use text navigation; Symptoms has {sum(map_counts.values())} image links to separate lessons.", "",
             "All lessons are drafts. Clinical approval and per-claim source-quote verification are pending.",
             "Bibliographic references and source locators below support editorial review; no independent judge or clinical approval is claimed.",
             "",
             "| Topic | Lesson | Text |", "|---|---|---|"]
    for lesson in data["lessons"]:
        draft = drafts[lesson["id"]]
        path = f"{folders[lesson['topic_id']]}/lessons/{lesson['id']}.md"
        text = [f"# {lesson['title']}", "", "AI-authored draft. Source-faithfulness and clinical review pending.", "",
                f"Lesson: `{lesson['id']}` · Topic: `{lesson['topic_id']}` · About {lesson['est_minutes']} minutes", ""]
        for p in lesson["pages"]:
            text += [f"## Page {p['order']}", "", p["body"], ""]
            for illustration in lesson.get("images", []):
                if illustration["page"] == p["order"]:
                    asset = next(m for m in data["media"] if m["id"] == illustration["media_id"])
                    text += [f"![{asset['alt_text']}](../../{asset['file']})", "", asset["credit"], ""]
        text += ["## Key takeaways", "", *[f"- {t}" for t in lesson["key_takeaways"]], "",
                 "## References and reviewer notes", "", draft["review_notes"], ""]
        for row in lesson_source_rows(ROOT, draft, registry):
            text.append(f"- [{row['title']}]({row['lesson_href']}) ? {row['locator']} (lesson pages {row['pages']}; {row['kind']}). {row['contribution']} Limits: {row['limits']}")
        for rid in draft["references"]:
            ref = authored["references"][rid]
            text.append(f"- [{ref['title']}]({ref['url']})")
        docs[path] = "\n".join(text) + "\n"
        lines.append(f"| {lesson['topic_id']} | `{lesson['id']}` | [{lesson['title']}]({path}) |")
    lines += ["", "## Files and rebuild", "", "- `psa-content.json`: schema 1.2 export for backend import.",
              "- `media/`: Symptoms navigation and original-derived lesson illustrations. No active home navigation image. The older course-overview prompt is retained as inactive generation history.",
              "- `image-selection.md`: navigation and lesson-image choices. `source-review.md` / `source-review.html`: every original file and its lesson-level use, location and limits.",
              "- `overview.html`: full course preview (course overview -> topic -> lesson); `hotspot-preview.html` redirects here. Local visual preview with real lesson navigation and a hotspot debug toggle.",
              "- `evaluation.md`: measured checks and remaining review.", "",
              "From the repository root:", "", "```powershell",
              ".venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/build_psa_library.py",
              ".venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/build_psa_library.py --validate", "```", "",
              "Canonical drafts: ../assisted-input/all-topics.json. Hotspots: ../assisted-input/image-maps.json.",
              "Supplied originals remain unchanged in ../originals/. Earlier generated navigation images are retained there as superseded history; the current home uses topic data only.",
              "No database migrations, imports, or publication are run by this builder. Source originals and extracted text are now eligible for Git tracking.", "",
              "The existing importer media limit is under 500 KiB; all JPGs meet it. Replacing or cropping an image requires rechecking its hotspots.",
              "The new topic-map database migration is supplied for later deployment. Imports leave maps at draft; public retrieval requires map publication and published target lessons."]
    docs["README.md"] = "\n".join(lines) + "\n"
    report = ["# Draft-library validation", "", "| Check | Result |", "|---|---|",
              f"| Schema and references | All six topics and {len(data['lessons'])} lessons validate |",
              "| IDs and membership | Exactly the lessons in topics.yaml, in order |",
              "| Course overview | Six text links derived from topics; optional course_map omitted |",
              f"| Maps | {', '.join(f'{tid}: {count} regions' for tid, count in map_counts.items())}; every topic lesson reachable |",
              "| Source originals | SHA-256 checked against source-inventory.json and authored supplemental_sources |",
              "| Original-to-lesson correspondence | Every original has a disposition; every lesson source has a locator, page, contribution and limits; image uses match media references |",
              "| Per-claim support / citation accuracy | Not assessed in this drafting pass; claims arrays intentionally empty |",
              "| Clinical review | Pending; all lessons remain draft |",
              "| Quizzes | Not generated in this text-and-map task |", "",
              "| Lesson | Maximum FK grade (pages and takeaways) |", "|---|---|"]
    for lesson in data["lessons"]:
        report.append(f"| {lesson['id']} | {lesson['checks']['fk_grade']:.2f} |")
    report += ["", "Reading scores are short-sample estimates, not proof of comprehension. The builder rejects page/takeaway scores at or above grade 8. Source-poster wording is preserved and is not included in these text scores; plain-language captions and surrounding lesson text explain the images.", "",
               "Home and five topics have no navigation image. The unchanged Symptoms image has 12 regions linking to 12 distinct lessons. GRAPPA remains a lesson illustration.",
               "The mixed PsA/AS photo is labeled and used for symptom reporting. Uncited comorbidity percentages are omitted. See source-review.md for all file dispositions and lesson locators.",
               "The preview uses normalized coordinates and preserves image aspect ratio. Native mobile device verification and clinical approval remain pending.", "",
               f"Draft input SHA-256: `{sha(INPUT.read_bytes())}`", f"Hotspot input SHA-256: `{sha(MAPS.read_bytes())}`", ""]
    for m in data["media"]:
        report.append(f"Image `{m['id']}` SHA-256: `{sha((OUT / m['file']).read_bytes())}`")
    docs["evaluation.md"] = "\n".join(report) + "\n"
    # Run metadata changes on rebuild; preview content is the stable patient data.
    preview_data = {k: v for k, v in data.items() if k != "run"}
    docs.update(review_documents(ROOT, authored, registry))
    preview_data["editorial_sources"] = {l["id"]: lesson_source_rows(ROOT, l, registry) for l in authored["lessons"]}
    docs["overview.html"] = render_preview(preview_data)
    docs["hotspot-preview.html"] = '<!doctype html><html lang="en"><meta charset="utf-8"><title>PsA preview</title><p><a href="overview.html">Open the course overview</a></p><script>location.replace("overview.html"+location.hash)</script></html>\n'
    return docs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--validate", action="store_true", help="Rebuild in memory and compare; no writes")
    args = parser.parse_args()
    try:
        data, authored, scores = build()
        docs = documents(data, authored, scores)
        export = OUT / "psa-content.json"
        if args.validate:
            saved = read(export)
            if {k: v for k, v in data.items() if k != "run"} != {k: v for k, v in saved.items() if k != "run"}:
                raise ValueError("Export differs from canonical drafts/maps; rebuild")
            if any(saved["run"][k] != data["run"][k] for k in ("model", "prompt_version")):
                raise ValueError("Export authorship differs from the builder")
            for name, text in docs.items():
                if (OUT / name).read_text(encoding="utf-8") != text:
                    raise ValueError(f"Generated document differs: {name}")
        else:
            OUT.mkdir(parents=True, exist_ok=True)
            export.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            for name, text in docs.items():
                path = OUT / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text, encoding="utf-8")
        maps = ([data["course_map"]] if "course_map" in data else []) + [t["image_map"] for t in data["topics"] if "image_map" in t]
        print(f"PASS: {len(data['topics'])} topics, {len(data['lessons'])} draft lessons, {len(maps)} image maps, "
              f"{sum(len(m['hotspots']) for m in maps)} valid hotspots; original hashes and media checked")
        print("Clinical review and per-claim support assessment are pending; no publication performed")
        return 0
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

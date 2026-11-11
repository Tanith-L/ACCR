"""The Data -> Backend contract check shared by the importer and the content pipeline.

`validate_export` checks an export against schema/content.schema.json and then the
cross-references the schema cannot express (IDs, membership, page ranges, hotspots).
"""
from __future__ import annotations

from collections import Counter
from pathlib import Path

from jsonschema import Draft202012Validator


def _dupes(label: str, ids: list[str]) -> list[str]:
    return [f"duplicate {label} id: {i}" for i, n in Counter(ids).items() if n > 1]


def _hotspot_geometry_errors(hotspot: dict, prefix: str) -> list[str]:
    errors = []
    if hotspot["shape"] == "rect":
        b = hotspot["bounds"]
        if b["x"] + b["width"] > 1 + 1e-9 or b["y"] + b["height"] > 1 + 1e-9:
            errors.append(f"{prefix}: rectangle extends outside the image")
    else:
        points = hotspot["points"]
        pairs = [(p["x"], p["y"]) for p in points]
        area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pairs, pairs[1:] + pairs[:1]))
        if len(set(pairs)) != len(pairs) or abs(area) < 1e-12:
            errors.append(f"{prefix}: polygon must have distinct vertices and nonzero area")
    return errors


def validate_export(data: dict, schema: dict) -> list[str]:
    """Schema errors plus the cross-reference checks. Empty list = valid."""
    errors = [
        f"{'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message}"
        for e in sorted(Draft202012Validator(schema).iter_errors(data), key=lambda e: list(map(str, e.absolute_path)))
    ]
    if errors:
        return errors

    subtopics = {s["id"]: (t["id"], s) for t in data["topics"] for s in t["subtopics"]}
    lesson_ids = [l["id"] for l in data["lessons"]]
    source_ids = {s["id"] for s in data["sources"]}
    media_ids = {m["id"] for m in data["media"]}
    lessons = {l["id"]: l for l in data["lessons"]}

    errors += _dupes("topic", [t["id"] for t in data["topics"]])
    errors += _dupes("subtopic", [s["id"] for t in data["topics"] for s in t["subtopics"]])
    errors += _dupes("lesson", lesson_ids)
    errors += _dupes("quiz", [q["id"] for q in data["quizzes"]])
    errors += _dupes("media", [m["id"] for m in data["media"]])
    errors += _dupes("source", [s["id"] for s in data["sources"]])
    errors += _dupes("claim", [c["id"] for l in data["lessons"] for c in l["claims"]])

    course_map = data.get("course_map")
    if course_map:
        if course_map["media_id"] not in media_ids:
            errors.append("course_map: unknown media_id")
        errors += _dupes("course hotspot", [h["id"] for h in course_map["hotspots"]])
        targets = [h["topic_id"] for h in course_map["hotspots"]]
        errors += _dupes("course target topic", targets)
        if set(targets) != {t["id"] for t in data["topics"]}:
            errors.append("course_map: targets must cover every exported topic exactly once")
        for h in course_map["hotspots"]:
            errors += _hotspot_geometry_errors(h, f"course hotspot {h['id']}")

    listed = Counter(i for _, s in subtopics.values() for i in s["lesson_ids"])
    for t in data["topics"]:
        image_map = t.get("image_map")
        if image_map is not None:
            if image_map["media_id"] not in media_ids:
                errors.append(f"topic {t['id']}: unknown image_map media_id {image_map['media_id']}")
            errors += _dupes(f"topic {t['id']} hotspot", [h["id"] for h in image_map["hotspots"]])
            for hotspot in image_map["hotspots"]:
                target = lessons.get(hotspot["lesson_id"])
                prefix = f"topic {t['id']} hotspot {hotspot['id']}"
                if target is None:
                    errors.append(f"{prefix}: unknown lesson_id {hotspot['lesson_id']}")
                elif target["topic_id"] != t["id"]:
                    errors.append(f"{prefix}: target lesson belongs to a different topic")
                errors += _hotspot_geometry_errors(hotspot, prefix)
        for s in t["subtopics"]:
            for i in s["lesson_ids"]:
                if i not in lessons:
                    errors.append(f"subtopic {s['id']} lists unknown lesson {i}")
                elif (lessons[i]["topic_id"], lessons[i]["subtopic_id"]) != (t["id"], s["id"]):
                    errors.append(f"lesson {i} is listed in {s['id']} but says it belongs to {lessons[i]['subtopic_id']}")
    for i in lesson_ids:
        if listed[i] != 1:
            errors.append(f"lesson {i} appears in {listed[i]} subtopic lesson_ids (expected 1)")

    for l in data["lessons"]:
        if l["subtopic_id"] not in subtopics:
            errors.append(f"lesson {l['id']}: unknown subtopic_id {l['subtopic_id']}")
        elif subtopics[l["subtopic_id"]][0] != l["topic_id"]:
            errors.append(f"lesson {l['id']}: subtopic {l['subtopic_id']} is not in topic {l['topic_id']}")
        if [p["order"] for p in l["pages"]] != list(range(1, len(l["pages"]) + 1)):
            errors.append(f"lesson {l['id']}: page orders must be 1..n")
        errors += _dupes(f"lesson {l['id']} image", [i["media_id"] for i in l.get("images", [])])
        for img in l.get("images", []):
            if img["media_id"] not in media_ids:
                errors.append(f"lesson {l['id']}: unknown media_id {img['media_id']}")
            if img["page"] > len(l["pages"]):
                errors.append(f"lesson {l['id']}: image on page {img['page']} but only {len(l['pages'])} pages")
        for c in l["claims"]:
            if c.get("kind") == "provenance":
                errors += _dupes(f"claim {c['id']} reference", [r["id"] for r in c["references"]])
                errors += _dupes(f"claim {c['id']} source use", [u["source_id"] for u in c["source_usage"]])
                for usage in c["source_usage"]:
                    if usage["source_id"] not in source_ids:
                        errors.append(f"claim {c['id']}: unknown source_id {usage['source_id']}")
                    if any(page > len(l["pages"]) for page in usage["pages"]):
                        errors.append(f"claim {c['id']}: lesson page out of range in source_usage")
                continue
            if c["source_id"] not in source_ids:
                errors.append(f"claim {c['id']}: unknown source_id {c['source_id']}")
            if c["page"] > len(l["pages"]):
                errors.append(f"claim {c['id']}: page {c['page']} out of range")

    for q in data["quizzes"]:
        if q["lesson_id"] not in lessons:
            errors.append(f"quiz {q['id']}: unknown lesson_id {q['lesson_id']}")
        if q["source_id"] not in source_ids:
            errors.append(f"quiz {q['id']}: unknown source_id {q['source_id']}")
        if q["answer"] >= len(q["options"]):
            errors.append(f"quiz {q['id']}: answer {q['answer']} is not a valid option index")
    for m in data["media"]:
        if m["source_id"] not in source_ids:
            errors.append(f"media {m['id']}: unknown source_id {m['source_id']}")
    return errors


def find_upwards(start: Path, relative: str) -> Path | None:
    for d in [start, *start.parents]:
        if (d / relative).exists():
            return d / relative
    return None

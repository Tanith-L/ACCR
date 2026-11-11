"""Offline contract checks for actual topic navigation images and lesson targets."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend/scripts"))
from contract import validate_export
from import_content import image_dimensions, media_errors


class ImageMapTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = json.loads((ROOT / "schema/content.schema.json").read_text(encoding="utf-8"))
        cls.library = json.loads((ROOT / "data/psa/chapter/psa-content.json").read_text(encoding="utf-8"))
        cls.legacy = json.loads((ROOT / "backend/fixtures/mock_export.json").read_text(encoding="utf-8"))

    def image_map(self, data):
        return next(t["image_map"] for t in data["topics"] if t["id"] == "symptoms")

    def test_real_library_has_all_registered_lessons_and_reachable_maps(self):
        self.assertEqual([], validate_export(self.library, self.schema))
        self.assertEqual(24, len(self.library["lessons"]))
        self.assertTrue(all(l["status"] == "draft" for l in self.library["lessons"]))
        self.assertTrue(all(l["checks"]["fk_grade"] < 8 for l in self.library["lessons"]))
        for topic in self.library["topics"]:
            if "image_map" not in topic:
                continue
            self.assertEqual({l["id"] for l in self.library["lessons"] if l["topic_id"] == topic["id"]},
                             {h["lesson_id"] for h in topic["image_map"]["hotspots"]})
        self.assertEqual([], media_errors(self.library, ROOT / "data/psa/chapter"))

    def test_legacy_10_still_valid_but_cannot_silently_use_new_map_fields(self):
        self.assertEqual([], validate_export(self.legacy, self.schema))
        data = copy.deepcopy(self.library)
        data["schema_version"] = "1.0"
        self.assertTrue(validate_export(data, self.schema))

    def test_unknown_or_foreign_targets_are_rejected(self):
        for target in ("missing-lesson", "psa-treatment-01"):
            data = copy.deepcopy(self.library)
            self.image_map(data)["hotspots"][0]["lesson_id"] = target
            self.assertTrue(any("hotspot" in e for e in validate_export(data, self.schema)))

    def test_duplicate_hotspot_and_missing_image_are_rejected(self):
        data = copy.deepcopy(self.library)
        m = self.image_map(data)
        m["hotspots"].append(copy.deepcopy(m["hotspots"][0]))
        m["media_id"] = "missing-image"
        errors = validate_export(data, self.schema)
        self.assertTrue(any("duplicate" in e for e in errors))
        self.assertTrue(any("unknown image_map media_id" in e for e in errors))

    def test_rectangle_cannot_extend_beyond_image(self):
        data = copy.deepcopy(self.library)
        self.image_map(data)["hotspots"][0]["bounds"].update(x=0.9, width=0.2)
        self.assertTrue(any("outside the image" in e for e in validate_export(data, self.schema)))

    def test_polygon_and_rectangle_have_distinct_shapes(self):
        data = copy.deepcopy(self.library)
        h = self.image_map(data)["hotspots"][0]
        h.update(shape="polygon", points=[{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.2, "y": 0.3}])
        self.assertTrue(validate_export(data, self.schema))  # ambiguous bounds + points
        del h["bounds"]
        self.assertEqual([], validate_export(data, self.schema))
        h["points"][2] = {"x": 0.2, "y": 0.1}
        self.assertTrue(any("nonzero area" in e for e in validate_export(data, self.schema)))

    def test_dimension_and_image_hash_changes_are_detected(self):
        data = copy.deepcopy(self.library)
        m = self.image_map(data)
        m["image_width"] += 1
        m["image_sha256"] = "0" * 64
        errors = media_errors(data, ROOT / "data/psa/chapter")
        self.assertTrue(any("dimensions" in e for e in errors))
        self.assertTrue(any("hash mismatch" in e for e in errors))

    def with_optional_course_map(self):
        data = copy.deepcopy(self.library)
        source_map = self.image_map(data)
        data["course_map"] = {k: v for k, v in source_map.items() if k != "hotspots"}
        data["course_map"]["hotspots"] = [
            {"id": "topic-" + t["id"], "label": t["name"], "topic_id": t["id"],
             "shape": "rect", "bounds": {"x": 0, "y": n / 6, "width": 1, "height": 0.16}}
            for n, t in enumerate(data["topics"])]
        return data

    def test_images_are_optional_and_symptoms_has_one_lesson_per_region(self):
        self.assertNotIn("course_map", self.library)
        self.assertEqual(["symptoms"], [t["id"] for t in self.library["topics"] if "image_map" in t])
        targets = [h["lesson_id"] for h in self.image_map(self.library)["hotspots"]]
        self.assertEqual(12, len(targets))
        self.assertEqual(12, len(set(targets)))
        data = copy.deepcopy(self.library)
        for topic in data["topics"]:
            topic.pop("image_map", None)
        for lesson in data["lessons"]:
            lesson.pop("images", None)
        data["media"] = []
        self.assertEqual([], validate_export(data, self.schema))
        self.assertEqual([], media_errors(data, ROOT / "data/psa/chapter"))

    def test_course_navigation_uses_all_six_topics_not_lessons(self):
        course = self.with_optional_course_map()["course_map"]
        self.assertEqual([t["id"] for t in self.library["topics"]], [h["topic_id"] for h in course["hotspots"]])
        for version in ("1.0", "1.1"):
            data = self.with_optional_course_map()
            data["schema_version"] = version
            self.assertTrue(validate_export(data, self.schema))
        for target in ("missing-topic", "psa-overview-01", "symptoms"):
            data = self.with_optional_course_map()
            data["course_map"]["hotspots"][0]["topic_id"] = target
            self.assertTrue(validate_export(data, self.schema))
        data = self.with_optional_course_map()
        data["course_map"]["hotspots"][0]["lesson_id"] = "psa-dx-01"
        self.assertTrue(validate_export(data, self.schema))

    def test_course_geometry_and_image_hash_are_checked(self):
        data = self.with_optional_course_map()
        data["course_map"]["hotspots"][0]["bounds"].update(x=0.9, width=0.5)
        self.assertTrue(any("outside the image" in e for e in validate_export(data, self.schema)))
        data["course_map"]["image_sha256"] = "0" * 64
        self.assertTrue(any("course_map" in e and "hash" in e for e in media_errors(data, ROOT / "data/psa/chapter")))

    def test_grappa_poster_is_kept_for_the_app_and_all_assets_are_used(self):
        overview = next(t for t in self.library["topics"] if t["id"] == "overview")
        self.assertNotIn("image_map", overview)
        # Lessons show only real images; the AI-generated GRAPPA poster stays for the app's Symptoms screen.
        lesson = next(l for l in self.library["lessons"] if l["id"] == "psa-overview-02")
        self.assertEqual(lesson.get("images", []), [])
        authored = json.loads((ROOT / "data/psa/assisted-input/all-topics.json").read_text(encoding="utf-8"))
        self.assertEqual(authored["app_posters"], ["psa-overview-grappa-domains"])
        used = set(authored["app_posters"])
        used |= {t["image_map"]["media_id"] for t in self.library["topics"] if "image_map" in t}
        used |= {i["media_id"] for l in self.library["lessons"] for i in l.get("images", [])}
        self.assertEqual(used, {m["id"] for m in self.library["media"]})
        assets = {p.relative_to(ROOT / "data/psa/chapter").as_posix() for p in (ROOT / "data/psa/chapter/media").glob("*.jpg")}
        self.assertEqual(assets, {m["file"] for m in self.library["media"]})

    def test_located_source_uses_match_original_files_and_displayed_images(self):
        from pipeline.source_correspondence import validate_correspondence
        authored = json.loads((ROOT / "data/psa/assisted-input/all-topics.json").read_text(encoding="utf-8"))
        registry = {s["id"]: s for s in json.loads((ROOT / "data/psa/source-inventory.json").read_text(encoding="utf-8"))}
        registry.update({s["id"]: s for s in authored["supplemental_sources"]})
        validate_correspondence(ROOT, authored, registry)
        for mutation in ("missing_locator", "invalid_page", "false_image_use"):
            data = copy.deepcopy(authored)
            row = data["lessons"][0]["source_usage"][0]
            if mutation == "missing_locator":
                row["locator"] = ""
            elif mutation == "invalid_page":
                row["pages"] = [99]
            else:
                row["kind"] = "text_and_image"
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                validate_correspondence(ROOT, data, registry)

    def test_dimension_reader_handles_png_and_jpeg(self):
        self.assertEqual((1, 1), image_dimensions(ROOT / "backend/fixtures/mock-joints.png"))
        self.assertEqual((1152, 1712), image_dimensions(ROOT / "data/psa/chapter/media/overview-grappa-domains.jpg"))
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "broken.jpg"
            path.write_bytes(b"not an image")
            with self.assertRaises(ValueError):
                image_dimensions(path)


if __name__ == "__main__":
    unittest.main()

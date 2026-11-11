# Navigation and lesson images

The home screen lists six topics from `topics[]`. Five topics list their subtopics and lessons without a navigation image. Only Symptoms retains the supplied clinical manifestations body map.

## Symptoms: one region, one lesson

| Region | Lesson |
|---|---|
| Skin / psoriasis | psa-symptoms-01 |
| Eyes | psa-symptoms-02 |
| Subtitle: lasting damage / related health | psa-symptoms-03 |
| Gut | psa-symptoms-04 |
| Shoulders | psa-symptoms-05 |
| Wrists, hands and nails | psa-symptoms-06 |
| Feet / enthesitis | psa-symptoms-07 |
| Spine and SI joints | psa-symptoms-08 |
| Elbows | psa-symptoms-09 |
| Hips | psa-symptoms-10 |
| Knees | psa-symptoms-11 |
| Ankles | psa-symptoms-12 |

The source image and normalized rectangles are unchanged. Targets now open separate short lessons, rather than one of three combined lessons. Decorative body dots are not navigation targets.

## Lesson illustrations

Navigation images and lesson illustrations are independent optional fields. The earlier request for relevant original illustrations inside lessons remains in effect.

| Lesson | Original-derived image | Purpose |
|---|---|---|
| psa-overview-02, page 1 | GRAPPA domains poster | Explain the six disease domains |
| psa-symptoms-01, page 2 | Elbow skin psoriasis | Illustrate skin patches and scales |
| psa-symptoms-06, page 2 | Nail psoriasis | Illustrate nail changes |
| psa-symptoms-07, page 1 | Achilles and plantar heel pictures | Distinguish back-of-heel and bottom-of-heel locations |

The full Symptoms body map is displayed at topic level only. There are six active JPG assets: one topic image and five lesson illustrations.

The old generated course JPG and its superseded generation prompt have been removed from chapter/media. Its original remains in originals/generated.

## Source use and limits

See [source-review.html](source-review.html) or [source-review.md](source-review.md) for all originals, exact lesson locations and excluded material. Handwritten mindmap content is rewritten in plain language rather than embedded as a navigation image. Comorbidity percentages are not copied without identified study provenance. The 2000 RheumNotes collection and AI-generated disease ranking remain reviewer background. UX notes and welcome media are not clinical lesson evidence.

The builder checks every original disposition and source hash, every lesson source use and page number, all image references, and a maximum Flesch-Kincaid score below grade 8 for lesson pages and takeaways. Original poster wording is not included in that reading score. Clinical approval and per-claim verification remain pending.

Canonical inputs: `../assisted-input/all-topics.json`, `image-maps.json`, `source-review.json`, and repository `topics.yaml`. Rebuild with `pipeline/build_psa_library.py`; preview with [overview.html](overview.html).

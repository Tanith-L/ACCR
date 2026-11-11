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

Lesson images are **real clinical photos only**, from `originals/RheumNotes_PsA_Clinical_Images.pdf` (Helliwell, Coates and Gladman, "Psoriatic Arthritis", in *A Clinician's Pearls & Myths in Rheumatology*, 2nd ed., Springer Nature 2023). The PDF marks the figures internal-only without publisher permission; the team confirmed permission on 2026-11-11. Each image shows the full citation as its credit.

| Lesson | Image (page) |
|---|---|
| psa-dx-01 | Spine X-ray (2), next to the sentence about X-rays |
| psa-dx-02 | Nail changes and dactylitis (2), two signs CASPAR counts |
| psa-symptoms-06 | Dactylitis (1), nail changes (2) |
| psa-symptoms-08 | Spine X-ray (1) |

Other lessons have no image: no other real image fits. The AI-generated posters, poster crops and Wikimedia diagrams are not used inside lessons.

The body map stays as the Symptoms navigation image and the GRAPPA poster as the app's second clickable Symptoms poster (`app_posters` in all-topics.json).

The old generated course JPG and its superseded generation prompt have been removed from chapter/media. Its original remains in originals/generated.

## Source use and limits

See [source-review.html](source-review.html) or [source-review.md](source-review.md) for all originals, exact lesson locations and excluded material. Handwritten mindmap content is rewritten in plain language rather than embedded as a navigation image. Comorbidity percentages are not copied without identified study provenance. The 2000 RheumNotes collection and AI-generated disease ranking remain reviewer background. UX notes and welcome media are not clinical lesson evidence.

The builder checks every original disposition and source hash, every lesson source use and page number, all image references, and a maximum Flesch-Kincaid score below grade 8 for lesson pages and takeaways. Original poster wording is not included in that reading score. Clinical approval and per-claim verification remain pending.

Canonical inputs: `../assisted-input/all-topics.json`, `image-maps.json`, `source-review.json`, and repository `topics.yaml`. Rebuild with `pipeline/build_psa_library.py`; preview with [overview.html](overview.html).

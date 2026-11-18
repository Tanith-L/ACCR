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

Real clinical photos from `originals/RheumNotes_PsA_Clinical_Images.pdf` (Helliwell, Coates and Gladman, "Psoriatic Arthritis", in *A Clinician's Pearls & Myths in Rheumatology*, 2nd ed., Springer Nature 2023) are added alongside the illustrations. The PDF marks the figures internal-only without publisher permission; the team confirmed permission on 2026-11-11. Each image shows the full citation as its credit.

| Lesson | Clinical photo (page) |
|---|---|
| psa-dx-01 | Spine X-ray (2), next to the sentence about X-rays |
| psa-dx-02 | Nail changes and dactylitis (2), two signs CASPAR counts |
| psa-symptoms-06 | Dactylitis (1), nail changes (2) |
| psa-symptoms-08 | Spine X-ray (1) |

The GRAPPA poster is also the app's second clickable Symptoms poster (`app_posters` in all-topics.json).

The full Symptoms body map is used both for topic navigation and as a general whole-body illustration in psa-overview-01, page 1. The overview lesson reuses the existing body-map asset. The complete-library pass, with the clinical photos, has 31 active JPG assets, covering all 24 lessons.

The old generated course JPG and its superseded generation prompt have been removed from chapter/media. The current originals directory no longer contains the superseded generated navigation assets.

## November 17 source update

The existing six assets and all twelve Symptoms hotspots are preserved. Eleven illustrations extracted from the newly supplied PDFs supplement the existing lessons:

| Lesson | Added image | Source PDF page |
|---|---|---|
| psa-overview-01, page 1 | Whole-body PsA overview (existing asset reused) | Supplied clinical manifestations poster |
| psa-symptoms-05, page 1 | Shoulder anatomy | Anatomy, 20 |
| psa-symptoms-06, page 1 | Hand and wrist bones | Anatomy, 33 |
| psa-symptoms-07, page 2 | Foot bones | Anatomy, 63 |
| psa-symptoms-08, page 1 | Spine regions | Anatomy, 13 |
| psa-symptoms-09, page 1 | Elbow anatomy | Anatomy, 27 |
| psa-symptoms-10, page 1 | Pelvis and hip ligaments | Anatomy, 41 |
| psa-symptoms-11, page 1 | Knee anatomy, several views | Anatomy, 49 |
| psa-symptoms-12, page 1 | Ankle anatomy | Anatomy, 57 |
| psa-education-02, page 2 | Quiet reflection outdoors | Mind / Mastery, 16 |
| psa-education-03, page 1 | Fruit example (high-resolution original) | Wikimedia Commons: Red Apple.jpg; replaces Nutrition p. 17 thumbnail |
| psa-education-03, page 2 | Clock and sleep routine | Sleep / Restore, 19 |

Images were visually inspected, extracted, resized and JPEG-compressed without new crops or labels. Each stays below the importer’s 500 KiB limit. Normal anatomy is labeled as such; OA, RA and gout disease images and examination maneuvers are not substituted for PsA illustrations. Existing skin, nail and heel illustrations remain in place.

Each image carries the creator, license, license URL, Commons file URL and PDF page in its displayed credit. [The attribution manifest](media/rheumnotes-attributions.json) also records the exported image hash. Attribution is transcribed from the supplied appendices; this is not an independent rights audit. Small original figure labels may require opening the full image; plain-language captions explain the main point.

Nutrition uses the November 17 version. Full extracted-text comparison found the terminology change from “Air” to “Sky” in protein headings and related dataset rows. Both original PDFs remain available. The broader Anatomy Chart is used as a text reference; its dense nine-panel poster is not embedded as a small lesson image. The licensing summary informs editorial records, while the Rheumy survey, portraits and greetings are retained as interface materials rather than clinical evidence.

## Source use and limits

See [source-review.html](source-review.html) or [source-review.md](source-review.md) for all originals, exact lesson locations and excluded material. Handwritten mindmap content is rewritten in plain language rather than embedded as a navigation image. Comorbidity percentages are not copied without identified study provenance. The 2000 RheumNotes collection and AI-generated disease ranking remain reviewer background. UX notes and welcome media are not clinical lesson evidence.

The builder checks every original disposition and source hash, every lesson source use and page number, all image references, and a maximum Flesch-Kincaid score below grade 8 for lesson pages and takeaways. Original poster wording is not included in that reading score. Clinical approval and per-claim verification remain pending.

Canonical inputs: `../assisted-input/all-topics.json`, `image-maps.json`, `source-review.json`, and repository `topics.yaml`. Rebuild with `pipeline/build_psa_library.py`; preview with [overview.html](overview.html).

## Overview chapter image scope

The introduction uses the whole-body PsA poster to show the broad range of affected areas. The second lesson retains the six-domain GRAPPA poster. The detailed normal-joint cross-section is no longer exported or displayed; regional anatomy images remain in the Symptoms lessons.

## Complete-library image pass

All 24 lessons now have at least one topic-matched image. The full page-level mapping is generated in [image-coverage.md](image-coverage.md). Existing overview and regional illustrations are preserved.

Four previously collected supplementary images are used: the NEI eye diagram, digestive anatomy, an MRI scanner and a clinician-patient discussion photo. Each was visually inspected, hash-checked and copied unchanged, with the existing creator/license/source attribution. The conversation photo illustrates a care discussion; the people are not represented as ACCR staff or confirmed PsA patients.

Seven original editorial diagrams summarize the existing sourced lessons: CASPAR, related health, treatment roles, flare records, four pillars, shared treatment goals and reporting eye/gut changes. These avoid the obscured CASPAR source table, uncited comorbidity percentages, drug-dose rules and an irrelevant heel-spur image. They are credited as editorial diagrams rather than reproduced source figures. Editable inputs are `../assisted-input/lesson-diagrams.json` and `../assisted-input/diagrams/*.svg`; `pipeline/render_lesson_diagrams.py` regenerates the JPEGs (install `pipeline/requirements-image-tools.txt` if needed).

All source categories were considered. Duplicate anatomy diagrams remain available but are not stacked into lessons; older Nutrition is superseded by the November 17 version; historical medical notes, interface prototypes, preference surveys and unreviewed video links retain their documented review limits.

## Distinct lesson illustrations

Each image is now used by only one lesson. The diagnostic lesson retains the MRI image; the consultation photo appears only in contact-01. Treatment goals and eye/gut reporting have their own editorial diagrams. Eye and digestive anatomy remain in their dedicated symptom lessons. The whole-body poster still serves both overview-01 and the Symptoms topic navigation, so the navigation map is unchanged.

The apple thumbnail (241 x 180) was replaced with a 1400 x 1269 export from the 2418 x 2192 original Commons photograph. The original is retained in originals/supplementary; the export remains below 500 KiB and uses a new filename to avoid cached blurry previews.

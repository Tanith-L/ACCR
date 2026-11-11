# PsA educational content

This is the single entry point for source organization, the complete lesson drafts, and their generation inputs.

## Complete draft library and clickable image maps

[Complete library](chapter/README.md) contains all six topics and twenty-four registered lessons, with English lesson text and source-review notes.
[Schema 1.3 export](chapter/psa-content.json) contains a `symptoms` lesson map, original-source lesson illustrations, and each lesson's references and source usage inside `claims` records with `kind: provenance`.
The simple course overview has six topic links. The supplied symptoms poster has twelve lesson links; GRAPPA is a lesson illustration, not the course navigation.
See [image selection](chapter/image-selection.md) for the four-poster analysis and exact lesson mapping.
Open [the offline preview](chapter/overview.html) to click image regions and read lessons; enable Show click regions to inspect bounds.

These are draft texts with bibliographic references; per-claim quote verification and clinical review remain pending.
They have not been published or imported into a live service.

Canonical inputs are [all-topics.json](assisted-input/all-topics.json) and [image-maps.json](assisted-input/image-maps.json).
Run `pipeline/build_psa_library.py` to rebuild, or add `--validate` for a read-only comparison.
The [evaluation](chapter/evaluation.md) records measured checks and remaining review.

## Core inputs

| File | Purpose |
|---|---|
| [organization.yaml](organization.yaml) | Six-part classification, source locators, planned content and gaps |
| [source-inventory.json](source-inventory.json) | IDs, original paths, types, SHA-256 hashes and extraction metadata for all 20 source files |
| [assisted-input/all-topics.json](assisted-input/all-topics.json) | Current 24 lessons, bibliographic references, source usage and illustrations |
| [assisted-input/image-maps.json](assisted-input/image-maps.json) | Current Symptoms navigation image and lesson targets |
| [assisted-input/source-review.json](assisted-input/source-review.json) | Original-file dispositions and editorial review scope |

For the current library, edit `assisted-input/all-topics.json` or `assisted-input/image-maps.json` and rebuild with `pipeline/build_psa_library.py`.
The retired two-lesson sample, its manifest, dedicated assembly script/test and superseded image prompt have been removed.
Exported provenance resolves reference IDs into titles/URLs and preserves source usage, including lesson pages, source locators, contributions and limits. It does not invent source quotes or establish per-claim support.

The original files remain in `originals/`. Locally extracted PDF/DOCX text remains in `extracted/`.
Both directories are eligible for Git tracking. The supplied ZIP can restore the archived reference set; user-added illustrations and the generated course overview are also retained locally. Originals have not been modified.

## Six learning parts

Detailed card-level classifications and source notes are maintained in organization.yaml.

| Order | Part | Topic ID | Main source materials | Main gaps |
|---|---|---|---|---|
| 1 | Understanding diagnosis | dx | One-Pager CASPAR box and mind map; RheumNotes as historical background | Diagnostic journey and tests |
| 2 | Understanding Psoriatic Arthritis | overview | One-Pager, clinical manifestations, GRAPPA, body map | Verify source claims and figures |
| 3 | Symptoms and disease progression | symptoms | GRAPPA, clinical manifestations, symptom body map, comorbidity poster | Disease progression and per-claim source verification |
| 4 | Treatment options and flare management | treatment | Selected Management Guidelines, One-Pager, mind-map treatment/MDA, Preface | Flare definitions and an approved management plan |
| 5 | Daily life with PsA | education | Four Pillars, Preface, selected Management Guidelines | Doctor's do's/don'ts and confirmed FAQ answers |
| 6 | Talking with your care team | contact | Symptom body map, clinical manifestations, One-Pager | Routine/urgent criteria, medicine concerns and ACCR contact channels |

The hierarchy in [topics.yaml](../../topics.yaml) contains 24 registered lesson IDs.
All 24 registered lesson IDs have text drafts in the complete library linked above.
The current outputs are consolidated under `chapter/`.

## Source limitations

- Ten files are educational candidates, one is historical background, and nine are workflow, UX or prototype references.
- Candidate status does not establish clinical approval. Approval is recorded as `not_recorded`.
- The One-Pager CASPAR table is partly obscured; the handwritten mind map needs transcription review.
- The comorbidity poster's percentages lack visible study citations. Top Autoimmune Diseases identifies its list as AI-generated.
- RheumNotes is a scanned historical collection with a copyright date of 2000; it is not current treatment guidance.
- DOCX paragraph numbers and cached Word page breaks are not verified page numbers. Render a fixed PDF before making page-based claims.
- General arthritis, RA or OA material must not become unsupported PsA-specific advice.
- Prototype HTML, audio/video and interface notes are not clinical evidence.

## Run and validate

See [the pipeline guide](../../../docs/psa-lesson-pipeline.md) for dependency setup and API mode.

```powershell
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/build_psa_library.py
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/build_psa_library.py --validate
.venv/content-pipeline/Scripts/python.exe -X utf8 backend/scripts/import_content.py data/psa/chapter/psa-content.json --dry-run --media-dir data/psa/chapter
```

The importer dry run checks the local contract without reading or writing live database state.
Backend can import the JSON after migration `0008_lesson_provenance.sql` is applied. Provenance records are stored in `lessons.provenance`; verified assertions continue to use `lesson_claims`. The export includes six referenced images for Symptoms navigation and lesson illustrations.

To restore originals and extracted text:

```powershell
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/organize_psa_sources.py --archive 'C:\Users\user\Downloads\Fall 2026 ACCR Capstone Project.zip'
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/organize_psa_sources.py --validate --dry-run
```

The organizer validates source hashes and taxonomy mappings; it no longer generates separate part README files.
For a team review, open `chapter/overview.html` to navigate the lessons and inspect the image regions. Per-claim verification remains pending.

# PsA educational content

This is the single entry point for source organization and the Week 9 lesson sample.

## Current lessons and backend handoff

| File | Purpose |
|---|---|
| [Lesson 1](chapters/03-symptoms-and-disease-progression/lessons/psa-symptoms-01.md) | Changes in skin, nails, and joints |
| [Lesson 2](chapters/03-symptoms-and-disease-progression/lessons/psa-symptoms-02.md) | Eyes, gut, and movement |
| [Export JSON](chapters/03-symptoms-and-disease-progression/psa-symptoms-and-disease-progression.json) | One topic, two lessons, six questions and twenty cited claims for the backend |
| [Evaluation report](chapters/03-symptoms-and-disease-progression/eval_report.md) | Reading scores, source-faithfulness, coverage, timing and remaining review |

The two lessons retain their existing IDs and order under `symptoms / symptoms-domains`.
They were drafted and assessed in the interactive AI conversation, then assembled and validated with Python.
They remain `draft`. Clinical review and a timed manual comparison are pending.
The API implementation is retained; the earlier request returned HTTP 401, so this sample is not represented as a successful API generation run.

## Core inputs

| File | Purpose |
|---|---|
| [organization.yaml](organization.yaml) | Six-part classification, source locators, planned content and gaps |
| [source-inventory.json](source-inventory.json) | IDs, original paths, types, SHA-256 hashes and extraction metadata for all 20 source files |
| [week9-sample.yaml](week9-sample.yaml) | Selected sources, lesson IDs, briefs and the AI-editorial concept reference list |
| [assisted-input/symptoms.json](assisted-input/symptoms.json) | The single maintained copy of source transcriptions, lesson drafts, quizzes and individual AI assessments |

Change the assisted input when revising these lessons, update the relevant citations and assessments, then rebuild in a new output directory.
The validator compares the export with that canonical input and verifies the original source hashes.
There are no separate input snapshots, audit copies or source-text copies in the sample output directory.
If inputs change, an older export may no longer validate against them.

The original files remain in `originals/`. Locally extracted PDF/DOCX text remains in `extracted/`.
Both directories are git-ignored and can be restored from the supplied ZIP. Originals have not been modified.

## Six learning parts

Detailed card-level classifications and source notes are maintained in organization.yaml.

| Order | Part | Topic ID | Main source materials | Main gaps |
|---|---|---|---|---|
| 1 | Understanding diagnosis | dx | One-Pager CASPAR box and mind map; RheumNotes as historical background | Diagnostic journey and tests |
| 2 | Understanding Psoriatic Arthritis | overview | One-Pager, clinical manifestations, GRAPPA, body map | Verify source claims and figures |
| 3 | Symptoms and disease progression | symptoms | GRAPPA, clinical manifestations, symptom body map, comorbidity poster | Disease progression; nearby spinal-joint detail in the sample |
| 4 | Treatment options and flare management | treatment | Selected Management Guidelines, One-Pager, mind-map treatment/MDA, Preface | Flare definitions and an approved management plan |
| 5 | Patient education | education | Four Pillars, Preface, selected Management Guidelines | Doctor's do's/don'ts and confirmed FAQ answers |
| 6 | When to contact the care team | contact | Symptom body map, clinical manifestations, One-Pager | Routine/urgent criteria, medicine concerns and ACCR contact channels |

The hierarchy in [topics.yaml](../../topics.yaml) preserves 15 registered lesson IDs.
Registered IDs and available source material do not imply that all 15 lesson drafts are present.
The old root lesson/media files have been removed; the two linked sample lessons are the current retained drafts.

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

See [the pipeline guide](../../docs/psa-lesson-pipeline.md) for dependency setup and API mode.

```powershell
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/assemble_assisted_content.py --out data/psa/chapters/03-symptoms-and-disease-progression-rebuild
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/validate_content.py data/psa/chapters/03-symptoms-and-disease-progression
.venv/content-pipeline/Scripts/python.exe -X utf8 backend/scripts/import_content.py data/psa/chapters/03-symptoms-and-disease-progression/psa-symptoms-and-disease-progression.json --dry-run --media-dir data/psa/chapters/03-symptoms-and-disease-progression
```

The importer dry run checks the local contract without reading or writing live database state.
Backend can import the JSON without restructuring it. The export contains no patient-facing media.

To restore originals and extracted text:

```powershell
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/organize_psa_sources.py --archive 'C:\Users\user\Downloads\Fall 2026 ACCR Capstone Project.zip'
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/organize_psa_sources.py --validate --dry-run
```

The organizer validates source hashes and taxonomy mappings; it no longer generates separate part README files.
For a client demonstration, open an original poster beside the corresponding lesson, follow a claim to its source quote, then show the evaluation report.

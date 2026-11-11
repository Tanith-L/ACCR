# PsA lesson pipeline

Start with [data/psa/README.md](../data/psa/README.md) for the current 24 lessons, source materials and preview.

## Setup

Run from the repository root with Python 3.11 or newer:

```powershell
python -m venv .venv/content-pipeline
.venv/content-pipeline/Scripts/python.exe -m pip install -r pipeline/requirements.txt
.venv/content-pipeline/Scripts/python.exe -m nltk.downloader -d .venv/nltk_data cmudict
```

## Build and validate the current library

```powershell
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/build_psa_library.py
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/build_psa_library.py --validate
.venv/content-pipeline/Scripts/python.exe -X utf8 backend/scripts/import_content.py data/psa/chapter/psa-content.json --dry-run --media-dir data/psa/chapter
.venv/content-pipeline/Scripts/python.exe -X utf8 -m unittest discover -s pipeline/tests -q
```

Canonical inputs are `data/psa/assisted-input/all-topics.json`, `image-maps.json` and `source-review.json`. The builder produces the schema 1.3 export, lesson Markdown, source-review documents and offline preview in `data/psa/chapter/`.

The retired two-lesson sample, its manifest, dedicated assembly script and test, and superseded course-image prompt have been removed. Current source originals, source correspondence and active illustrations remain in place.

## Exported references and source usage

Each lesson exports one record at `lessons[].claims[]` with:

- `id`: a lesson-scoped record ID.
- `kind: "provenance"`: editorial correspondence, not a verified factual assertion.
- `references[]`: bibliographic IDs resolved to titles and URLs.
- `source_usage[]`: original source IDs, lesson pages, use kind, source locators, contributions and limits, preserved from canonical input.

`source_usage.pages` refers to lesson pages. DOCX paragraph locators are not physical source-page numbers. Source-use descriptions are not verbatim source quotes.

The pipeline does not invent `source_quote`, support labels or citation-accuracy scores. All current lessons remain `draft`; provenance cannot satisfy the `checked` gate. Source-quote verification and clinical approval remain separate work.

The contract [content.schema.json](../schema/content.schema.json) accepts versions 1.0 through 1.3. Version 1.3 adds provenance while preserving the original assertion format. See [the field documentation](content-json-schema.md).

## Backend import

Before a real schema 1.3 import, apply migrations in order through `backend/supabase/migrations/0008_lesson_provenance.sql`. The importer stores provenance losslessly in private `lessons.provenance` JSONB. Verified assertion rows continue to use `lesson_claims`. Provenance changes affect the evidence hash and update editable draft versions without changing patient text.

A local dry run checks schema, IDs, lesson-page references, source/media hashes and import decisions without reading settings or connecting to a database. Building or validating the library does not deploy migrations, import content or publish lessons.

Backend tests additionally require `backend/requirements.txt`. Run offline tests with:

```powershell
.venv/content-pipeline/Scripts/python.exe -m pytest backend/tests -m "not db" -q
```

## Optional generation with source quotes

The generic API generation and validation tools remain available for a new, explicitly supplied manifest:

```powershell
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/process_psa_content.py --manifest <manifest.yaml> --out .venv/psa-runs/<new-run>
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/validate_content.py .venv/psa-runs/<new-run>
```

Generation requires `OPENAI_API_KEY` and sends selected authorized source materials to the API. It is not run by the current-library builder. A manifest must identify source IDs, lesson scope and reference concepts; the old sample is no longer a default.

These tools assemble pages from cited sentences and retain source text, actual drafting/assessment calls and checks in `evidence.json`. Validation requires that file and rechecks hashes, quotes, support, numbers and reading level. API `checked` status indicates automated checks only, not clinical approval. Use `build_psa_library.py --validate` for the authored library rather than this stricter source-quote workflow.

# PsA lesson pipeline

Start with [data/psa/README.md](../data/psa/README.md) for the sources, classifications, two retained lessons and backend export.

## Setup

Run from the repository root with Python 3.11 or newer.

```powershell
python -m venv .venv/content-pipeline
.venv/content-pipeline/Scripts/python.exe -m pip install -r pipeline/requirements.txt
.venv/content-pipeline/Scripts/python.exe -m nltk.downloader -d .venv/nltk_data cmudict
```

Restore the source originals from the supplied archive if needed. PDF extraction and reading-measurement dependencies are pinned for reproducibility.

## Assemble the existing AI-assisted sample

```powershell
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/assemble_assisted_content.py --out data/psa/chapters/03-symptoms-and-disease-progression-rebuild
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/validate_content.py data/psa/chapters/03-symptoms-and-disease-progression-rebuild
```

The canonical input is [symptoms.json](../data/psa/assisted-input/symptoms.json): image transcriptions, drafted sentences, exact quotes, quizzes and explicitly authored AI assessments.
The [sample manifest](../data/psa/week9-sample.yaml) selects source IDs, topic/subtopic, ordered lesson IDs and reference concepts.
Use `--input` and `--manifest` with both commands when using other input files.

This mode makes no API calls. It reproduces saved AI content with a new run timestamp and measured Python assembly time.
Drafting and source assessment were performed by the same interactive assistant after the user chose this mode following an API authentication failure.
No successful API generation, independent judge, clinical review or manual-time saving is claimed.

## Generate new content through the API

Set `OPENAI_API_KEY` in the process environment. Never commit it.
This command sends selected educational images/text to OpenAI; use sources authorized for that processing.

```powershell
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/process_psa_content.py --manifest data/psa/week9-sample.yaml --out data/psa/chapters/03-symptoms-and-disease-progression-api
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/validate_content.py data/psa/chapters/03-symptoms-and-disease-progression-api
```

The default model is `gpt-5.4-mini`; `--model` selects another compatible model.
Structured output uses the [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create) with image input support.
Temperature is omitted by default; pass `--temperature 0` only for models that support it.
Extraction, drafting and judging use separate prompts in `pipeline/prompts/`, with a maximum of two content revisions.
They use the same model, which is not independent clinical review.

API runs retain one `evidence.json` containing source pages, the manifest and real call records.
It replaces separate source, audit, call and attempt files and is needed to revalidate API output.
`--reuse-sources <earlier-run>/evidence.json` reuses extraction after hash checks; its timing excludes the earlier extraction.

## Core output

Directories are named `<chapter-number>-<chapter-name>` under `data/psa/chapters/`, for example `03-symptoms-and-disease-progression`. JSON files are named `psa-<chapter-name>.json`. Both generation commands use these names automatically; `--out` overrides the directory when rebuilding or keeping another version. Run timestamps remain inside the JSON metadata.

For the existing two-lesson sample, the output directory contains only:

- `psa-<chapter-name>.json`: backend content.
- `lessons/psa-symptoms-01.md` and `psa-symptoms-02.md`: readable versions of that content, including quizzes and source evidence.
- `eval_report.md`: metrics, provenance, coverage gaps and remaining review.

API runs additionally need `evidence.json`. Interactive runs use the canonical assisted input directly instead of storing another copy.
Use a new directory for each run. Editing canonical input invalidates older exports until rebuilt; historical input snapshots are not kept in output folders.
The scripts do not generate demo pages, duplicate README files, blank review/timing worksheets or standalone import logs.

## Source support and validation

- Images: model transcription, one source page per image. Original hashes are checked.
- Text PDFs: physical page numbers from pypdf. Empty/scanned pages need registered images or a verified text PDF.
- DOCX: the organizer extracts paragraphs, but lesson generation requires a rendered fixed-page PDF. Paragraphs are not source-page numbers.
- Nonclinical assets are excluded from lesson evidence.

Every page is assembled from cited sentences; takeaways reuse cited sentences.
Each fact has a source ID, physical source page/image index and exact quote.
Quote matching, source-support assessments, quiz answers/feedback, numbers, safety flags, reading scores and structural relationships are checked.
Unresolved evidence or reading-level problems prevent an importable export.
Coverage is reported, not a pass gate. The sample's 11/12 coverage is against an AI-editorial list; human-baseline coverage is still unmeasured.

FK and SMOG scores cover pages, takeaways and quizzes. Short-sample SMOG is approximate; fewer than three sentences are not scored.
All content remains `draft`. Clinical approval, human concept identification, judge calibration and manual timing remain separate work.

## Backend contract

The unchanged contract is [content.schema.json](../schema/content.schema.json), version 1.0.
Its full field documentation is [content-json-schema.md](content-json-schema.md).

| Content | Contract field |
|---|---|
| Learning hierarchy and order | `topics[].subtopics[].lesson_ids` and page order |
| Lesson title and text | `title`, `pages[].body` |
| Summary | `key_takeaways`; no separate summary field |
| Provenance | Actual source type/hash; claim source ID, page and exact quote |
| AI authorship and review state | `generated_by: llm`, `status: draft` |
| Quizzes | Three per lesson, zero-based answer index and cited feedback |
| Reading level | Maximum measured FK/SMOG across patient-text units |
| Human concept coverage | `checks.coverage: null` until a human baseline exists |

```powershell
.venv/content-pipeline/Scripts/python.exe -X utf8 backend/scripts/import_content.py <export.json> --dry-run --media-dir <run-directory>
.venv/content-pipeline/Scripts/python.exe -X utf8 -m unittest discover -s pipeline/tests -q
```

No backend database or schema code is changed by the pipeline. Clinical review and publishing use the existing backend workflow.

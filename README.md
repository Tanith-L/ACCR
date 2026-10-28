# RheumNotes PsA: Backend

Backend for a proof-of-concept iOS app (React Native / Expo) that teaches patients with Psoriatic Arthritis using clinician-approved content. Built for the Altoona Center for Clinical Research (CMU Heinz capstone).

The backend stores content in Supabase (Postgres + Storage), tracks each lesson through review, and serves **only published lessons** to the app. There is no custom server.

> New to the project? Read [docs/project-guide.md](docs/project-guide.md) first. It explains how Data, Backend and Frontend fit together and what each person delivers. [CLAUDE.md](CLAUDE.md) is the context file for Claude Code.

The [PsA content directory](data/psa/README.md) is the entry point for source classifications, the two current lessons, the validated backend JSON and the evaluation report. See the [pipeline guide](docs/psa-lesson-pipeline.md) for generation and validation commands.

## How it works in one minute

```
export JSON ──► import_content.py ──► Supabase ──► review_import.py ──► publish.py ──► app (anon key)
(Data Lead)     validate, gate,        draft /       Dr. Murphy's          reviewed →     reads published
                version, load          checked       scores                published      rows only
```

Lesson status moves `draft → checked → reviewed → published` (`archived` for replaced versions). Only SQL functions change it, and the app can read nothing but published rows.

## Setup

**You need:** Python 3.11+, and a Supabase project. (Docker and the Supabase CLI are optional.)

```bash
pip install -r backend/requirements.txt
cp .env.example .env        # then fill in the four values
```

`.env` (git-ignored; never commit it):

| Variable | Used by | Where to find it |
|---|---|---|
| `SUPABASE_URL` | import (image upload), the app | Dashboard → Project Settings → API |
| `SUPABASE_ANON_KEY` | the app and API checks | Same page. Safe to give to Frontend. |
| `SUPABASE_SERVICE_KEY` | image upload only | Same page. **Backend only.** |
| `SUPABASE_DB_URL` | every script | Dashboard → Connect → connection string (Postgres) |

The service key and database URL give full access to the data. Keep them out of code, tests, fixtures, the app, chat and commits.

### Create the database
Apply the migrations in order, either with the Supabase CLI (`supabase db push`) or by pasting each file into the dashboard's SQL editor:

| File | What it does |
|---|---|
| `backend/supabase/migrations/0001_content_schema.sql` | Tables, constraints, versioned lessons |
| `0002_published_access.sql` | Row-level security, grants, the published views, `get_learning_path` |
| `0003_review_publish.sql` | `apply_review`, `publish_lesson`, `rollback_lesson` |
| `0004_import_support.sql` | `lessons.evidence_hash` and the public `media` Storage bucket |

Never edit a migration that has been applied. Add a new numbered one.

## Everyday commands

Run these from the repository root. Every script supports `--dry-run`, prints a summary, and fails without writing anything partial.

**Legacy converter** (requires the former `lessons/` and `media/` inputs, which have been removed from this working tree; use the current export linked above for the Week 9 sample):
```bash
python backend/scripts/convert_repo_content.py --out backend/exports/export_psa_real.json
```

**Import an export** (checks the file, then uploads images and writes all rows in one transaction):
```bash
python backend/scripts/import_content.py <export.json> --media-dir <folder with the images> --dry-run
python backend/scripts/import_content.py <export.json> --media-dir <folder with the images> --dry-run --from-db   # compare with what is stored
python backend/scripts/import_content.py <export.json> --media-dir <folder with the images>                      # the real import
```

**Review** (Dr. Murphy scores Rubric B; the pass rule is computed in SQL, so the sheet's `decision` column is ignored):
```bash
python backend/scripts/review_import.py --make-sheet backend/exports/review_sheet.csv    # checked lessons only
python backend/scripts/review_import.py scores.csv --reviewer "Dr. Murphy" --dry-run
python backend/scripts/review_import.py scores.csv --reviewer "Dr. Murphy"
```

**Publish and roll back** (a deliberate step, run after the review):
```bash
python backend/scripts/publish.py --lesson psa-dx-01 --dry-run
python backend/scripts/publish.py --lesson psa-dx-01 [--version 2]
python backend/scripts/publish.py --all-reviewed
python backend/scripts/publish.py --rollback psa-dx-01
```
Changes are appended to `backend/logs/publish_log.jsonl` (local to the machine that ran them).

**Demo content** (invented lessons with their own IDs so they never touch real content):
```bash
python backend/scripts/make_demo_export.py          # writes backend/exports/export_psa_demo.json
```

## Tests

```bash
pytest backend/tests -q
```

- Tests that need no database always run.
- Database tests use the project in `.env`, but every one runs inside a transaction that is **always rolled back**, with its own `zzt-` IDs, so nothing is ever committed. They skip when `SUPABASE_DB_URL` is not set or migration 0004 is not applied.
- Tests that act as the app use the anon key only.

## How content changes are handled

| Situation | What the importer does |
|---|---|
| New lesson | Inserts version 1 |
| Same content again | Skips (safe to re-run) |
| `draft` / `checked` lesson, text changed | Updates in place |
| `draft` / `checked` lesson, same text but new claims, checks or status | Updates in place (a draft can become `checked`) |
| `reviewed` / `published` lesson, text changed | Inserts **version + 1**; patients keep seeing the old version until the new one is reviewed and published |
| Topic or subtopic name or order, lesson placement, image caption | Updates in place with no new version |
| Any error in the file | Rejects the whole file; nothing is written |

A `checked` lesson that fails the credibility gate (`citation_accuracy = 1`, no unsupported or contradicted claims, `numbers_ok`, no safety flags, `fk_grade ≤ 8`) is imported as `draft`.

## What the app can access

With the anon key the app can read only four things (details in [backend/docs/api-contract.md](backend/docs/api-contract.md)):

| Screen | Request |
|---|---|
| Topics | `GET /rest/v1/v_topics` |
| Learning path | `POST /rest/v1/rpc/get_learning_path` |
| Lesson | `GET /rest/v1/v_lessons?id=eq.<id>` |
| Quiz | `GET /rest/v1/v_quiz_items?lesson_id=eq.<id>` |
| Images | `GET /storage/v1/object/public/media/<path>` |

Base tables are locked (row-level security with no policies, no grants), and the review and publish functions cannot be called with the anon key. Example responses live in `backend/fixtures/mock_responses/` so the app can be built before the backend is live.

## Repository layout

```
schema/content.schema.json     the Data → Backend contract (JSON Schema 2020-12)
backend/
  supabase/migrations/         database changes, numbered
  scripts/                     import_content, review_import, publish,
                               convert_repo_content, make_demo_export
  tests/                       pytest
  fixtures/                    mock_export.json, mock_responses/
  docs/api-contract.md         Backend ↔ Frontend contract
  exports/                     generated files (git-ignored)
  logs/                        publish log
docs/                          Week 9 plan, architecture, pipeline design, schema doc, project guide
```

## Working agreement
- Feature branches and pull requests; small commits.
- Tell the Data Lead before changing `schema/content.schema.json` (bump `schema_version`). Tell Frontend before changing `backend/docs/api-contract.md`.
- No PHI anywhere: no names, emails, symptoms or free text from patients.
- Do not move or edit the Data Lead's content files without agreement.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `missing settings ... SUPABASE_DB_URL` | `.env` not found or the variable is empty. Scripts search upward from `backend/scripts`; environment variables override `.env`. |
| Database tests all skipped | No `SUPABASE_DB_URL`, or migration 0004 is not applied. |
| `file rejected (n problems)` | The export failed validation. Every problem is listed; fix them all and re-run with `--dry-run`. |
| `media ... not found` | Pass `--media-dir` pointing at the folder with the image files. |
| `only reviewed lessons can be published` | The lesson is still `draft` or `checked`. Run the review import first. |
| App gets `[]` | The lesson, or its topic, is not published. This is expected for drafts. |
| App gets `401` | Wrong or missing API key, or the app is asking for a base table. |

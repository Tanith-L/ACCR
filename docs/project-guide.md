# RheumNotes PsA: Project Guide (Data · Backend · Frontend)

Owner: Vanshika (Backend Lead) · v1 · Oct 28, 2026 · Status: **Week 9 in progress**
Read by: Vanshika (Backend), Lyra (Data), Penelope (Frontend), and each person's Claude Code.

> **For Claude Code:** read this whole file first, then the files named in your section (§9). Do what your section says; do not edit another role's files. Where this guide and a source file disagree, the source file wins: tell the user about the difference.

## 1. What we are building
A proof-of-concept iOS app (React Native / Expo) that teaches patients with **Psoriatic Arthritis (PsA)** using **clinician-approved content**. Client: Altoona Center for Clinical Research (Dr. Frederick Murphy). The app shows only content that has been **checked automatically, reviewed by Dr. Murphy, and deliberately published**. Nothing else may reach a patient.

| Person | Role | Owns |
|---|---|---|
| Vanshika | Backend Lead | Database, import / review / publish tools, API contract, backend tests |
| Lyra | Data Lead | Content pipeline (LLM drafting + credibility checks), the export JSON |
| Penelope | Frontend | The React Native app |
| Maggie | PM / documentation | Reports, evaluation write-up |
| Dr. Murphy | Clinical reviewer | Scores lessons with Rubric B |

## 2. The system in one picture

```
 DATA (Lyra)                      BACKEND (Vanshika)                          FRONTEND (Penelope)
 ───────────                      ──────────────────                          ───────────────────
 approved source docs
   │ P1 ingest   (text + page markers + file hash)
   │ P2 LLM draft (lessons, quizzes, claims with source quotes)
   │ P3 validate  (schema)
   │ P4 credibility checks   P5 readability (grade ≤ 8)
   ▼
 export_<disease>_<yyyymmdd>_<run>.json ───► import_content.py
 (schema/content.schema.json)                 validate → gate → upload images → one transaction
                                              status: draft | checked
 review sheet ──► Dr. Murphy (Rubric B) ──► review_import.py → apply_review()   (SQL decides pass/revise)
                                              reviewed
                                            publish.py → publish_lesson()
                                              published
                                                │
                                                ▼
                                      Supabase Postgres + Storage   ◄───────── app, anon key only
                                      v_topics · v_lessons · v_quiz_items       GET views, POST rpc
                                      rpc/get_learning_path · bucket "media"   pull-to-refresh
```

Three handoffs, and these are the **only** interfaces between the roles:
1. **Data → Backend:** the export JSON (`schema/content.schema.json`).
2. **Backend → Frontend:** the REST API (`backend/docs/api-contract.md`).
3. **Backend ↔ Data (review loop):** reviews that say "revise" go back to Lyra with a comment; she fixes the content and re-exports.

## 3. Decisions that must not change without asking Vanshika
1. **Supabase free tier** (Postgres + auto REST + Storage). **No custom always-on server.**
2. Content lives in Postgres. Lesson status: `draft → checked → reviewed → published` (`archived` = replaced version).
3. Lessons are **versioned**: primary key `(id, version)`. A reviewed or published version is never edited in place; a change inserts `version + 1`.
4. Status changes **only** through the SQL functions `apply_review`, `publish_lesson`, `rollback_lesson`. The Rubric B pass rule is enforced in SQL.
5. The app reads **only** `v_topics`, `v_lessons`, `v_quiz_items` and `rpc/get_learning_path` with the **anon key**. Base tables have row-level security on with no policies, and anon has no grants.
6. The data pipeline **exports JSON; the backend only imports it.** No LLM code in `backend/`; no database code in the pipeline.
7. The pipeline can set only `draft` or `checked`. Only the review sets `reviewed`. Publishing is a separate human step.
8. **No PHI**: no names, emails, symptoms or free text from patients anywhere.
9. Sign-in and study tables (progress, events) are **Phase 3**, not Week 9. The app keeps lesson progress **on the device**.

## 4. Status lifecycle (who moves a lesson, and what stops them)

```
draft ──(fix + re-export)──► checked ──apply_review: pass──► reviewed ──publish_lesson──► published
  ▲                              │ revise (stays checked,                                   │
  └──── comment to Lyra ◄────────┘  comment goes back to Data)        new version published ─► archived
                                                                       rollback_lesson ◄──────┘
```

| Step | Decided by | Enforced by |
|---|---|---|
| → `draft` / `checked` | Pipeline checks | Pipeline, **and again** in `import_content.py` (a `checked` lesson that fails the gate is imported as `draft`) |
| `checked` → `reviewed` | Dr. Murphy's Rubric B scores | `apply_review()` in SQL: Accuracy 5, Safety 5, all others ≥ 4, FK grade ≤ 8 |
| `reviewed` → `published` | A team member, deliberately | `publish.py` → `publish_lesson()`; archives the previous published version |
| rollback | A team member | `rollback_lesson()` re-publishes the latest archived version |

**The `checked` gate** (all must be true): `schema_valid`; `citation_accuracy = 1.0`; `unsupported = 0`; `contradicted = 0`; `numbers_ok`; `safety_flags` empty; `fk_grade ≤ 8`. A missing field counts as failing.

## 5. The data contract (Data → Backend)

Files: `schema/content.schema.json` (machine-readable, JSON Schema 2020-12) and `docs/content-json-schema.md` (explanations). Example: `backend/fixtures/mock_export.json`.

**Rules**
- One file per run: `export_<disease>_<yyyymmdd>_<run>.json`, UTF-8. Images ship **next to** the JSON (PNG/JPG, under 500 KB).
- IDs are lowercase letters, digits and hyphens, and are **stable**. Never rename an ID after it is imported: the backend updates rows by ID, and a renamed ID looks like a new lesson.
- Lesson IDs: `psa-<topic>-<nn>`. Claim IDs: `<lesson id>-c<n>`. Quiz IDs: `<lesson id>-q<n>`.
- The schema is strict (`additionalProperties: false`): extra or misspelled fields are errors.
- Any schema change needs `schema_version` bumped and both Data and Backend told.

**Top level:** `schema_version`, `run`, `disease`, `sources[]`, `topics[]` (with nested subtopics and `lesson_ids`), `lessons[]`, `quizzes[]`, `media[]`.

**Limits:** lesson 1–4 pages, 1–3 takeaways, 1–5 minutes; quiz 2–4 options, `answer` is a 0-based index; claims need `source_id`, `source_page`, an exact `source_quote`, `support`, and `quote_match` (0–1).

**What the importer checks** (any error rejects the **whole file**, nothing is written): the schema; every `*_id` exists; no duplicate IDs; every subtopic lesson exists and each lesson is in exactly one subtopic; page orders are 1..n; quiz `answer` is a valid index; image files exist and are small; a lesson uses each image at most once.

**What the importer does with a valid file**

| Latest stored version | Action |
|---|---|
| none | insert version 1 |
| `draft` / `checked`, text changed | update in place |
| `draft` / `checked`, text same but claims / checks / status changed | update in place (a draft that gains claims can become `checked`) |
| `reviewed` / `published` / `archived`, text changed | insert **version + 1**; the live version is untouched until the new one passes review |
| text unchanged on a `reviewed` / `published` version | skip |

"Text" means title, minutes, pages, takeaways, images and quiz items (`content_hash`). Topic and subtopic names and order, lesson placement, and image captions update in place without a new version.

## 6. The API contract (Backend → Frontend)

Full details and example responses: `backend/docs/api-contract.md` and `backend/fixtures/mock_responses/*.json`.

Base: `{SUPABASE_URL}/rest/v1`. Headers: `apikey: <anon key>` and `Authorization: Bearer <anon key>`.

| Screen | Request |
|---|---|
| Topic selection | `GET /v_topics?select=id,name,icon,sort_order&order=sort_order` |
| Learning path | `POST /rpc/get_learning_path` body `{ "p_topic_id": "dx" }` |
| Lesson | `GET /v_lessons?id=eq.<lesson id>` (array with one item) |
| Quiz | `GET /v_quiz_items?lesson_id=eq.<lesson id>&order=id` |
| Image | `GET {SUPABASE_URL}/storage/v1/object/public/media/<path>` (no auth header) |

**Errors the app must handle**

| Case | Response | App behavior |
|---|---|---|
| Unknown or unpublished lesson | `200` with `[]` | Empty state |
| Topic with nothing published | `[]` from `get_learning_path` | Empty state |
| Bad filter or parameter | `400` | Error state, log it |
| Missing or invalid API key | `401` | Error state |
| Network failure or timeout | none | Retry once, then error state |

Decide on the **HTTP status**, never on the error message text. Fetch on screen open and on pull-to-refresh; `version` and `updated_at` show when a lesson changed. **Never hard-code** topic names, lesson titles or counts: content changes without an app release.

## 7. Deliverables by person

### 7.1 Vanshika (Backend)
Done and tested (203 tests): content schema; mock export; repo-content converter; database migrations 0001–0004 applied to the Supabase project; `import_content.py` (validate, gate, version, upload, one transaction, `--dry-run`, `--from-db`); `review_import.py` (review sheet from `checked` lessons, score import, SQL decides pass/revise); `publish.py` (publish, rollback, dry-run, log); `make_demo_export.py`; access, review/publish and integrity tests; API contract and mock responses.

Live in the project: the 15 real lessons as `draft` (invisible to the app), and the **demo content** (`demo` topic, `psa-demo-01` published, `psa-demo-02` checked, `psa-demo-03` draft). The demo content is invented, and its review is recorded as a rehearsal, not a clinical review. Remove it before real content goes live.

To do for Week 9:
| # | Deliverable | Done when |
|---|---|---|
| 1 | REST-level tests with the **real anon key** | Shapes and order match the contract; drafts hidden; base tables, writes and review/publish functions refused; 400 / 401 / empty cases correct |
| 2 | `perf/latency.py` | Median and p95 for 50 requests per endpoint, with region and network noted |
| 3 | Evaluation report | The template in `docs/week9-backend-implementation.md` §10, filled in |
| 4 | `README.md` | How to set up `.env`, apply migrations, run tests |
| 5 | Commit and push on a feature branch | The kit folder is not committed yet |

### 7.2 Lyra (Data)
Your pipeline ends at **one validated export JSON** (plus `review_sheet.csv` and `eval_report.md`).

| # | Deliverable | Done when |
|---|---|---|
| 1 | Sign off `schema/content.schema.json` (or ask for changes) | Written confirmation |
| 2 | P1 ingest | Each approved source has an ID, title, type and the **real SHA-256 file hash** |
| 3 | P2 LLM draft | Lessons, quizzes and a claim with an **exact source quote** for every factual sentence |
| 4 | P3 validation | 100% of exported records pass the schema and cross-reference checks |
| 5 | P4 credibility checks | `quote_match`, `support`, `numbers_ok`, `safety_flags`, counts, `citation_accuracy` set honestly |
| 6 | P5 readability | `fk_grade` and `smog` ≤ 8, or the lesson stays `draft` |
| 7 | Media | `alt_text` (≤ 20 words), `credit`, `source_id` for every image |
| 8 | Week 9 content | One PsA topic, 2–3 lessons plus quizzes, exported and passing the importer's dry run |
| 9 | Act on "revise" comments | Fix, re-export; the importer updates drafts in place |

**Hard rules for the pipeline:** only Dr. Murphy's approved materials, and only after he agrees to LLM processing and the provider's data terms are checked; the LLM uses only the given text; every fact is a claim with a source quote; set only `draft` or `checked`; record model, prompt version and source hashes on every run; never commit credentials.

**Check your export before sending it:**
`python backend/scripts/import_content.py <your export>.json --dry-run --media-dir <images folder>` prints exactly what the backend would do and lists every problem.

**Your first existing files** (`topics.yaml`, `lessons/*.md`, `quizzes.yaml`, `media/`) are **read-only input** for the backend. They have no claims or quotes, so they can only be `draft` until the pipeline produces real claims.

### 7.3 Penelope (Frontend)
| # | Deliverable | Done when |
|---|---|---|
| 1 | Build against `backend/fixtures/mock_responses/*.json` first | App runs with no backend |
| 2 | Topic selection → learning path → lesson viewer → quiz | Each reads only the endpoints in §6 |
| 3 | Lesson viewer | One page at a time in `order`; images by `images[].page` with `alt_text` and `credit`; `key_takeaways` at the end |
| 4 | Quiz | `answer` is the 0-based index; show `feedback` after answering |
| 5 | Empty and error states | All five cases in the §6 table |
| 6 | Refresh | Fetch on screen open and pull-to-refresh; replace cached lessons when `version` or `updated_at` differ |
| 7 | Progress service on the device | Lesson completion stored locally behind one small interface, so Phase 3 can swap in the backend |
| 8 | Switch to the live API | One config change (`SUPABASE_URL`, anon key); no code change |

**Hard rules for the app:** the **anon key only**; never the service key or database URL; read only the four endpoints plus public images; no PHI; no hard-coded content.

## 8. Repo layout and commands
```
schema/content.schema.json            shared contract (Data ↔ Backend)
.gitignore
backend/
  supabase/migrations/                0001–0004 (never edit an applied one; add 0005…)
  scripts/                            import_content.py, convert_repo_content.py
                                      (next: review_import.py, publish.py)
  tests/                              pytest; database tests run in rolled-back transactions
  fixtures/                           mock_export.json, mock-joints.png, mock_responses/
  docs/api-contract.md                Backend ↔ Frontend contract
docs/                                 week9 plan, architecture v5, pipeline design, schema doc, this guide
CLAUDE.md                             context for Claude Code
```
- Run tests: `pytest backend/tests -q` (database tests need `.env` and skip without it).
- Convert the existing content: `python backend/scripts/convert_repo_content.py [--dry-run]`
- Dry-run an import: `python backend/scripts/import_content.py <export.json> --dry-run [--from-db] [--media-dir DIR]`
- Real import (Backend only): the same command without `--dry-run`.

## 9. Which files each person (and their Claude Code) should read
| Role | Read first | Do not edit |
|---|---|---|
| Backend | `CLAUDE.md`, `docs/week9-backend-implementation.md`, `docs/backend-architecture.md` | The Data Lead's content files |
| Data | `docs/content-json-schema.md`, `schema/content.schema.json`, `docs/content-pipeline-design.md`, `backend/fixtures/mock_export.json` | `backend/`, migrations |
| Frontend | `backend/docs/api-contract.md`, `backend/fixtures/mock_responses/` | `backend/`, `schema/` |

## 10. Secrets and safety
- `.env` (git-ignored) holds `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_DB_URL`. `.env.example` has empty values.
- Only the Backend Lead uses the **service key** and **database URL**. They never go in code, tests, fixtures, the app, chat, or commits.
- The app and Frontend tests use the **anon key only**.
- Never print keys. Never write to the shared Supabase project from a test except inside a transaction that is rolled back.
- The `media` Storage bucket is **public by URL**: only non-clinical images for now. Revisit (private bucket with signed URLs) in Week 10.

## 11. Open items (resolve these early)
| # | Item | Who |
|---|---|---|
| 1 | Sign-off on the content schema, including that `checks` requires only `schema_valid` | Lyra |
| 2 | **Uncited facts** gate: the pipeline design gates on it but the schema has no field for it | Lyra + Vanshika |
| 3 | Readability is scored per page in the design but `checks.fk_grade` is per lesson: use the highest page | Lyra |
| 4 | Quiz items have no stored check results (only a source quote and status) | Lyra + Vanshika |
| 5 | Who writes image `alt_text` and `credit`, and when | Lyra |
| 6 | Who generates the review sheet (pipeline P6 vs. from `checked` rows in the database) | Lyra + Vanshika |
| 7 | Replace the placeholder source hashes and source types in the converted content | Lyra |
| 8 | Icon names for topics (currently none) | Penelope + Lyra |
| 9 | Real error responses from the live project to replace the sample error JSON | Vanshika |
| 10 | Dr. Murphy's agreement to LLM processing, and the provider's data terms | Lyra / Maggie |
| 11 | Confirm Rubric B criteria and the pass rule | Dr. Murphy via Lyra |

## 12. Working agreement
- Feature branches and pull requests; small commits.
- **Tell Lyra** before changing `schema/content.schema.json` (and bump `schema_version`). **Tell Penelope** before changing `backend/docs/api-contract.md`.
- Every script supports `--dry-run`, prints a summary, and fails loudly on bad input without writing anything partial.
- SQL changes go in a **new** numbered migration.

## 13. Starter prompts for each person's Claude Code
- **Vanshika:** "Read `docs/project-guide.md` §3–§5 and §7.1. Build `scripts/review_import.py` and `scripts/publish.py` with tests that use rolled-back transactions only."
- **Lyra:** "Read `docs/project-guide.md` §5 and §7.2, then `docs/content-pipeline-design.md`. Build the pipeline stages P1–P6 so the export passes `import_content.py --dry-run`. Do not touch `backend/`."
- **Penelope:** "Read `docs/project-guide.md` §6 and §7.3, then `backend/docs/api-contract.md`. Build the screens against `backend/fixtures/mock_responses/` first. Use only the anon key."

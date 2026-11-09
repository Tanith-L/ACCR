# RheumNotes PsA: Project Architecture and Features

A proof-of-concept iOS app (React Native / Expo) that teaches patients with Psoriatic Arthritis (PsA) using clinician-approved content. Built by a CMU Heinz capstone team for the Altoona Center for Clinical Research (Dr. Frederick Murphy).

Last updated: 2026-11-07. This document describes what is built in the repository today. Planned work is listed separately in section 7.

---

## 1. System at a glance

The project has three layers. Content moves one way: from source documents, through the pipeline, into the database, and out to the app.

```
 LAYER 1: CONTENT PIPELINE        LAYER 2: BACKEND (Supabase)               LAYER 3: PATIENT APP
 (Data Lead, offline, Python)     (Postgres + REST + Storage, no server)    (Expo / React Native)
 ─────────────────────────        ──────────────────────────────────        ────────────────────
 Approved source documents                                                   Home · Topics · Lessons
   (data/psa/originals)                                                      Knowledge map · Quiz
        │                                                                    Care Team · Settings
        ▼                                                                         ▲
 Draft lessons + image maps       import_content.py ──► Postgres tables           │ anon key,
 (assisted-input/*.json)          (service key,          (RLS on, no policies)    │ read-only
        │                          one transaction)            │                  │
        ▼                                                      ▼                  │
 Checks: schema, references,      review_import.py ──► apply_review()       Published views
 source hashes, reading level     publish.py       ──► publish_lesson()     v_topics · v_lessons
        │                                              rollback_lesson()     v_quiz_items
        ▼                                                      │             rpc/get_learning_path
 psa-content.json (schema 1.2) ──► JSON export ───────────────┘             rpc/get_topic_image_map
 + review docs + HTML preview                                  Storage (public bucket: images)
```

Key rules that hold across all three layers:

- **Only published content reaches patients.** Lesson status moves `draft → checked → reviewed → published` (`archived` for replaced versions).
- **No PHI.** The system stores no names, emails, symptoms or free text from patients. Progress and preferences stay on the device.
- **No custom always-on server.** Supabase free tier only.
- **The pipeline and backend meet at one contract:** `schema/content.schema.json` (JSON Schema 2020-12).

---

## 2. Layer 1: Content pipeline (`pipeline/`, `data/`)

Owned by the Data Lead. It turns approved source documents into schema-valid JSON. The backend only imports its output, and no LLM code lives in `backend/`.

### 2.1 Inputs
| Path | Contents |
|---|---|
| `data/psa/originals/` | Supplied source documents and posters (unchanged originals) |
| `data/psa/source-inventory.json` | Registry of every source file with its SHA-256 hash |
| `data/psa/organization.yaml`, `topics.yaml` | Topic taxonomy: 6 topics, subtopics and lesson IDs, in order |
| `data/psa/assisted-input/` | Authored lesson drafts (`all-topics.json`), image maps (`image-maps.json`), source correspondence |

### 2.2 Scripts
| Script | Role |
|---|---|
| `build_psa_library.py` | Builds the current draft library: validates everything and writes `data/psa/chapter/psa-content.json` plus review documents. `--validate` rebuilds in memory and compares with the saved export. |
| `assemble_assisted_content.py`, `source_correspondence.py` | Assemble drafts and check that every lesson source has a locator, page, contribution and limits |
| `library_preview.py` | Generates a standalone HTML preview (course → topic → lesson) with clickable image regions |
| `process_psa_content.py`, `content_processing.py`, `validate_content.py` | The Week 9 workflow: source-grounded drafts with per-claim source quotes, an LLM judge, concept coverage and an evaluation report |
| `organize_psa_sources.py` | Organizes the source files into the chapter folders |

### 2.3 Checks the pipeline enforces
- Schema validity and cross-references (shared validator in `backend/scripts/contract.py`).
- Source file hashes match the inventory.
- Every original has a disposition, and every lesson source has a locator.
- Takeaways appear in the lesson text.
- Reading level below US grade 8 (Flesch-Kincaid; SMOG where available).
- Every topic image map reaches every lesson in its topic.

### 2.4 Output
`data/psa/chapter/psa-content.json` (schema 1.2): 6 topics, 24 lessons, 1 optional Symptoms image map. All lessons are `draft`. There are no quizzes and no per-claim verification yet, so none can pass the `checked` gate. Clinical approval is pending.

---

## 3. Layer 2: Backend (`backend/`)

Supabase Postgres with auto-generated REST (PostgREST) and Storage.

### 3.1 Data model (migrations 0001–0007)
| Table | Purpose |
|---|---|
| `diseases`, `topics`, `subtopics` | Hierarchy, ordered, each with a status |
| `lessons` | Primary key `(id, version)`. Pages and takeaways as jsonb, `checks` jsonb, `status`, `evidence_hash` |
| `lesson_claims` | Per-claim text with source, source page and verbatim quote |
| `quiz_items` | Questions, options, answer, feedback, source quote |
| `media`, `lesson_media` | Images (Storage path, alt text, credit) and where they appear |
| `sources`, `reviews`, `import_runs` | Provenance, Rubric B scores, import log |
| `topic_image_maps` | Clickable image per topic, with hotspots linking to lessons |
| `course_image_maps` | Clickable home image linking to topics (no data yet) |

### 3.2 Scripts
| Script | Role |
|---|---|
| `import_content.py` | Validates an export, applies the `checked` gate, plans versions, uploads images and writes all rows in one transaction. Supports `--dry-run` and `--from-db`. |
| `review_import.py` | Produces a review sheet of `checked` lessons and imports Dr. Murphy's Rubric B scores |
| `publish.py` | Publishes reviewed lessons, rolls back, logs to `backend/logs/publish_log.jsonl` |
| `contract.py` | Shared export validator and `find_upwards` helper (used by the importer and the pipeline) |
| `make_demo_export.py` | Builds invented demo content with its own IDs so it never collides with real lessons |

All scripts support `--dry-run`, print a summary and fail without writing anything partial.

### 3.3 Content lifecycle
| Situation | Importer behaviour |
|---|---|
| New lesson | Inserts version 1 |
| Same content again | Skips (safe to re-run) |
| `draft` or `checked` lesson, text changed | Updates in place |
| `reviewed` or `published` lesson, text changed | Inserts **version + 1**. Patients keep seeing the old version until the new one is published |
| Any error in the file | Rejects the whole file |

- **Credibility gate:** a lesson imported as `checked` must have `citation_accuracy = 1`, no unsupported or contradicted claims, `numbers_ok`, no safety flags and `fk_grade ≤ 8`. Otherwise it is imported as `draft`.
- **Rubric B pass rule** (enforced in SQL by `apply_review`, not trusted from the sheet): accuracy = 5, safety = 5, completeness, readability and terminology each ≥ 4, and `fk_grade ≤ 8`. A pass sets `reviewed`. Otherwise the lesson stays `checked` and returns to the Data Lead.
- **`publish_lesson`:** publishes a `reviewed` version, archives the one it replaces, publishes its quiz items and makes its subtopic and topic visible. **`rollback_lesson`** restores the latest archived version.
- Status changes happen only through these SQL functions, which are executable by the service role only.

### 3.4 Access control
- Row-level security is on for every base table with no policies, and grants are revoked from `anon` and `authenticated`.
- The app, using the anon key, can read only:

| Screen | Request |
|---|---|
| Topics | `GET v_topics` |
| Learning path | `rpc/get_learning_path` |
| Lesson | `GET v_lessons?id=eq.<id>` |
| Quiz | `GET v_quiz_items?lesson_id=eq.<id>` |
| Topic image map | `rpc/get_topic_image_map` |
| Images | Storage public bucket `media` |

- Views expose patient-facing fields only (no claims, checks or run metadata) and only `published` rows.
- Two more functions, `get_course_image_map` and `get_mind_map`, exist in the database but the app does not call them yet.
- The service key and database URL live in `.env` (git-ignored) and never appear in code, tests or the app.

### 3.5 Tests
`pytest backend/tests -q` covers the contract validator, the importer, the review and publish functions, access control (as the anon key), the mind map function and the mock responses. Database tests run inside transactions that are always rolled back and skip without `SUPABASE_DB_URL`.

---

## 4. Layer 3: Patient app (`frontend/`)

Expo SDK 58, expo-router, React Native 0.88, React 19, TypeScript, Jest. It also runs on web for development.

### 4.1 Content source switch
`EXPO_PUBLIC_CONTENT_SOURCE` selects where lessons come from. All three use the same `ContentService` interface.

| Source | Data | Use |
|---|---|---|
| `mock` | Backend sample responses (`backend/fixtures/mock_responses`) | Building UI before the backend was live |
| `preview` | The pipeline's real export, **drafts included** | Team review and demos |
| `supabase` | The live API, published content only | Production path |

### 4.2 Structure
```
src/app/            screens (expo-router): (tabs)/(home), care, settings, welcome
src/content/        ContentService, API client, transports (http, mock, preview), mappers, course, knowledge map
src/components/     MindMap, BodyMap, Markdown, LessonImage, ImageViewer, TopicCard, Quiz parts, Toast, ...
src/progress/       on-device lesson completion (ProgressContext)
src/preferences/    on-device settings, e.g. quizzes on/off
src/hooks/, utils/, theme.ts
```

---

## 5. Features and functionality

### For patients
- **Home:** welcome message, overall progress ("X of Y lessons finished") with a progress bar, an encouraging message, a Topics list with per-topic progress, and pull-to-refresh.
- **Topics and lessons:**
  - Six topics, each with a learning path of subtopics and lessons.
  - Lessons open one page at a time with Previous and Next page buttons.
  - Content is rendered from Markdown, with illustrations that open full screen.
  - The last page shows key takeaways and the source line.
  - Finishing a lesson marks it complete and offers the next lesson.
- **Knowledge map:** a one-screen, tap-to-explore diagram of how PsA fits together. Branches open on tap, nodes show completion, and a leaf opens the right lesson on the right page.
- **Clickable body map and posters:** tapping a body region on the Symptoms figure opens the matching lesson.
- **Optional quiz:** a short knowledge check after a topic's last lesson. It has an intro, one question at a time, a review after each answer and a private score. It can be skipped, and answers are not stored or sent anywhere.
- **Care Team tab:** an after-hours notice, guidance on routine questions versus contacting the team soon, and a shortcut to the symptom-description lessons when that topic is published.
- **Settings:** a quizzes on/off toggle, an About page and a reset-progress button with an on-screen confirmation.
- **Loading, empty and error states**, reduced-motion support and accessibility labels throughout.

### For the clinical and content team
- Source-grounded lesson drafts with a recorded provenance trail (source hash, locator, page and limits for every lesson source).
- Automatic credibility checks and a readability gate (below grade 8) before anything is marked `checked`.
- A Rubric B review step that cannot be bypassed from a spreadsheet.
- Versioned lessons: reviewed or published text is never edited in place.
- A deliberate publish step, rollback to the previous version, and a local publish log.
- An HTML preview of the full course, with a debug toggle for clickable regions.
- Content updates reach the app without a new app release (the app re-queries on screen open and pull-to-refresh).

### Privacy and safety
- Anonymous by design: no accounts, no PHI, no patient free text.
- Education only: no personalized advice.
- The app ships only the anon key.

---

## 6. Current status

| Area | State |
|---|---|
| Content | 24 draft lessons, 1 Symptoms image map, no quizzes, no per-claim verification, no clinical approval yet |
| Backend | Migrations 0001–0007 written. Import, review, publish and rollback implemented and tested |
| App | All screens built. Demos run on the `preview` source until content is published in the database |
| Publishing | Nothing is published in Supabase yet, so the live path is not yet exercised end to end with real content |

---

## 7. Planned and not yet built

- **Knowledge map served from the backend.** Today it is hardcoded in `frontend/src/content/knowledgeMap.ts`, and the poster hotspots are in `posterRegions.ts`. The plan is a node table imported from the pipeline and a rewritten `get_mind_map`, which needs a schema version bump agreed with the Data Lead and Frontend.
- **Study plane (Phase 3):** anonymous sign-in, progress, quiz attempts and events stored server-side.
- **Quizzes and per-claim verification** in the content library.
- **Offline bundle** of published content, a **glossary**, a shared care-team guidance block and an **admin review page**.

---

## 8. Running it

```bash
# Backend tests
pytest backend/tests -q

# Import (dry run first)
python backend/scripts/import_content.py data/psa/chapter/psa-content.json --media-dir data/psa/chapter --dry-run

# Rebuild or verify the pipeline output
python -X utf8 pipeline/build_psa_library.py [--validate]

# App
cd frontend && npm install && npx expo start
```

Secrets go in `.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_DB_URL`). The README has the full command list.

## 9. Related documents
- `README.md`: setup and everyday commands
- `docs/backend-architecture.md`: backend design history (v5, partly out of date: it still describes the study plane)
- `docs/content-json-schema.md` and `schema/content.schema.json`: the Data → Backend contract
- `backend/docs/api-contract.md`: the Backend ↔ Frontend contract
- `docs/content-pipeline-design.md`: pipeline and credibility checks

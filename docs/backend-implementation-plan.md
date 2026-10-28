# RheumNotes PsA — Backend Implementation Plan (step by step)

Owner: Vanshika Tiwari (Backend Lead) · v1 · Oct 25, 2026
Based on: `backend-architecture.md` (v5), `content-json-schema.md`, `content-pipeline-design.md` (v7), Week 9 Implementation Plan
Scope: **backend only.** Data pipeline (Lyra) and app screens (Penelope) appear here only where the backend depends on them.

> **Dates assume Week 9 = Oct 26 – Nov 1.** Shift them to the course calendar if that differs. The final presentation date is still TBD.

---

## Decisions this plan builds on
- **Content storage:** content lives in **Supabase Postgres tables** with a status of `draft → checked → reviewed → published` (`archived` for replaced versions).
- **Who writes content:** the **Data Lead's Python pipeline** produces JSON; the backend imports it. Only backend scripts (service key) write content.
- **What the app sees:** **published rows only**, through views and functions. The app ships the anon key only.
- **Sign-in comes later:** **anonymous sign-in is added near the end**, but **before any evaluation sessions with participants**. Until then, progress is stored on the device.
- **Server:** no always-on custom server. Logic lives in SQL (views, functions, RLS) plus Python scripts run by the team.

---

## Phase 0 · Setup (start of Week 9)

| # | Step | Done when |
|---|---|---|
| 0.1 | Create Supabase project **`rheumnotes-dev`** (free tier); store the URL, anon key, service key and DB connection string in a password manager | Keys stored, not in Git |
| 0.2 | Create backend folders in the shared repo (`backend/supabase/migrations`, `backend/scripts`, `backend/tests`, `backend/fixtures`) + `.env.example` + `.gitignore` for `.env` | PR merged |
| 0.3 | Install Supabase CLI; link the project; migrations run with `supabase db push` | `supabase db push` works |
| 0.4 | **Sign off `content-json-schema.md` v1 with Lyra** and commit `schema/content.schema.json` | Both leads approved |
| 0.5 | Write a **mock export** (`fixtures/mock_export.json`: 1 topic, 2 subtopics, 3 lessons, quizzes, 1 image) that passes the schema | Unblocks import work before Lyra's first real export |

## Phase 1 · Content database + delivery (Week 9)
Details are in `week9-backend-implementation.md`.

| # | Step | Done when |
|---|---|---|
| 1.1 | Migration `0001_content_schema.sql`: content tables, constraints, versioned lessons | Tables exist; constraints tested |
| 1.2 | Migration `0002_published_access.sql`: RLS on, grants revoked, published views, `get_learning_path` | Anon key reads only published rows |
| 1.3 | Migration `0003_review_publish.sql`: `apply_review`, `publish_lesson`, `rollback_lesson` | Status changes only through these |
| 1.4 | **B1 import script** (`import_content.py`): validate → status gate → versioning → one transaction → run log; uploads images to Storage | Mock export imports 100% correctly; re-import is idempotent |
| 1.5 | **B2 review import** (`review_import.py`): Rubric B CSV → `apply_review` | Pass → `reviewed`; revise → stays `checked` |
| 1.6 | **B3 publish** (`publish.py`): publish / rollback, with dry-run | Lesson appears in the app; rollback works |
| 1.7 | **API contract** (`docs/api-contract.md`) + mock responses for Frontend | Penelope builds against it |
| 1.8 | **Tests** (pytest): import, integrity, access control, API shape, errors; latency script | All pass; median / p95 reported |
| 1.9 | **Week 9 evaluation report** + client demo | Report sent to the Documentation Lead |

## Phase 2 · Real content + robustness (Week 10)

| # | Step | Done when |
|---|---|---|
| 2.1 | Import **Lyra's first real export**; fix schema mismatches (bump `schema_version` if fields change) | Real topic imported |
| 2.2 | Run the **first Rubric B round** with Dr. Murphy through `review_import.py`; publish passing lessons | First lessons published |
| 2.3 | **Media:** decide whether draft images can stay in a public bucket; if not, use a private bucket + signed URLs | Decision documented |
| 2.4 | **CI:** GitHub Actions runs schema validation + tests on every PR (against a local Supabase via the CLI) | Green check on PRs |
| 2.5 | Add **`/content-status` report** (SQL view for the team): counts per status, lessons waiting for review | Team can see the pipeline state |
| 2.6 | Handle edge cases found in Week 9 (renamed IDs, deleted lessons → `archived`, quiz changes) | Tests added |

## Phase 3 · Study data + anonymous sign-in (Weeks 11–12, before evaluation sessions)

| # | Step | Done when |
|---|---|---|
| 3.1 | Enable **anonymous sign-ins** in Supabase Auth; turn on CAPTCHA (Supabase recommends it; the default anonymous rate limit is 30/hour per IP) | App gets a session on first launch |
| 3.2 | Migration `0004_study_plane.sql`: `participants`, `progress`, `bookmarks`, `quiz_attempts`, `quiz_answers`, `assessment_responses`, `events` with RLS (each participant sees only their own rows) | RLS tests pass |
| 3.3 | RPCs: `my_progress_summary`, `log_events` (batched, idempotent `event_id`) | Frontend switches its progress service from device to backend |
| 3.4 | **One-time progress upload** on first sign-in (device → `progress`) | No progress lost |
| 3.5 | Optional **access code** (if the team decides): `participants.access_code_hash` + a redeem RPC | Decision recorded |
| 3.6 | Access tests: a participant cannot read or write another participant's rows | All refused |

## Phase 4 · Evaluation support (Weeks 12–13)

| # | Step | Done when |
|---|---|---|
| 4.1 | **Export views** for the evaluation: knowledge gain (post − pre), task results, events per participant, quiz results | CSV exports work |
| 4.2 | **Content-quality report**: grades before/after, claim-support stats, Rubric B pass rate, from `lessons.checks` + `reviews` | Numbers for the final presentation |
| 4.3 | **Keep-alive:** free-tier projects pause when inactive; schedule a light ping before and during evaluation weeks (or upgrade for that period) | Project active during sessions |
| 4.4 | **Data retention:** export + delete participant data at the end (confirm with Prof. Padman / IRB) | Script ready |

## Phase 5 · Hardening + handoff (Weeks 14–15)

| # | Step | Done when |
|---|---|---|
| 5.1 | Performance check on all published content (latency, payload size); add indexes if needed | Median / p95 within target |
| 5.2 | Backup: `pg_dump` of content tables + Storage export | Restore tested once |
| 5.3 | Final docs: architecture, schema, API contract, runbook (import → review → publish → rollback) | Another member can run it |
| 5.4 | Security review: no service key in the app or repo; RLS and grants re-tested; Supabase security advisor checked | Checklist done |

## Future work (after the semester)
- **Offline bundle:** export published rows to a cached JSON file.
- **Admin page:** a review and publish UI replacing the CSV sheet.
- **Mind map:** map tables plus vision-LLM transcription.
- **Shared care-team guidance block.**
- **Glossary.**
- **Realtime updates.**
- **Multi-disease support:** a `disease_id` already exists on topics.

## Dependencies on other leads

| Need | From | By |
|---|---|---|
| Schema sign-off | Lyra | Phase 0 |
| First real export | Lyra | Week 10 |
| Rubric B criteria + review time | Dr. Murphy | Week 10 |
| Agreement on the API contract; progress service | Penelope | Week 9 / Week 11 |
| Sign-in decision (anonymous only vs. access code) | Team + Dr. Murphy | Week 11 |
| IRB / consent | Maggie → Prof. Padman | Before Phase 3 sessions |

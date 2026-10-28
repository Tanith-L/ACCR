# RheumNotes PsA — Backend (Claude Code context)

## Project
CMU Heinz capstone for the Altoona Center for Clinical Research (Dr. Frederick Murphy). Proof-of-concept iOS app (React Native / Expo) that teaches patients with Psoriatic Arthritis (PsA) using clinician-approved content. Team: Vanshika (Backend Lead, owns this folder), Lyra (Data Lead, content pipeline), Penelope (Frontend), Maggie (PM / documentation).

## Read these first
- `docs/week9-backend-implementation.md`: **the current task spec** (Week 9)
- `docs/backend-implementation-plan.md`: phases 0–5 and what's next
- `docs/backend-architecture.md`: architecture v5 (source of truth for design)
- `docs/content-json-schema.md`: the Data → Backend JSON contract
- `docs/content-pipeline-design.md`: the Data Lead's pipeline and credibility checks (context only)

## Decisions (don't change without asking)
- Supabase free tier: Postgres + auto REST (PostgREST) + Storage. **No custom always-on server.**
- Content lives in Postgres tables. Lesson status: `draft → checked → reviewed → published` (`archived` for replaced versions).
- Lessons are versioned: PK `(id, version)`. Never edit a reviewed/published version in place; insert version + 1.
- Status changes **only** through SQL functions: `apply_review`, `publish_lesson`, `rollback_lesson` (migration 0003). The Rubric B pass rule is enforced in SQL.
- The app reads **only** `v_topics`, `v_lessons`, `v_quiz_items` and `rpc/get_learning_path` with the **anon key**. Base tables have RLS on with no policies, and grants are revoked from anon/authenticated.
- Anonymous sign-in and study tables (progress, events…) are **Phase 3**, not Week 9. Frontend keeps progress on the device for now.
- The Data Lead's pipeline exports JSON; the backend only imports it. Don't build LLM code in `backend/`.
- No PHI: no names, emails, symptoms or free text from patients.

## Current repo state (github.com/Tanith-L/ACCR, Oct 27)
- Repo root already holds the Data Lead's **first content set** (commit "Add initial PsA education content", Oct 1), in the earlier file format:
  - `topics.yaml`: 6 topics → subtopics → lesson IDs
  - `lessons/*.md`: 16 lessons, YAML front matter + body
  - `quizzes.yaml`
  - `media/media.yaml` + 5 JPGs
- Front matter fields: `id, title, topic_id, subtopic_id, est_minutes, source (free text, e.g. "PsA One-Pager Intro p.1; mindmap p.1"), status: draft, key_takeaways, images[{file, page}]`.
- Lesson bodies use paragraphs with **no `---page---` splits**. They have **no claims / source quotes / checks**, so they cannot pass the `checked` gate yet.
- **Don't move or edit these files** without the Data Lead's agreement. Treat them as read-only input.
- No README or .gitignore yet; add `.gitignore` (`.env`, `__pycache__/`, `.venv/`, `supabase/.temp/`).

## Layout (backend additions)
```
backend/
  supabase/migrations/   0001_content_schema.sql, 0002_published_access.sql, 0003_review_publish.sql
  scripts/               import_content.py (B1), review_import.py (B2), publish.py (B3)
  tests/                 pytest
  perf/latency.py
  fixtures/              mock_export.json, mock_responses/
  docs/api-contract.md
schema/content.schema.json   (shared with Data Lead; JSON Schema 2020-12)
```

## Week 9 bridge for the existing content
- `backend/scripts/convert_repo_content.py` reads the root YAML/MD files and writes a schema-valid export JSON:
  - each body becomes one page, or several split at `---page---` if present;
  - `source` text → `sources[]` entries with generated IDs;
  - `claims: []`, `checks` with only the readability numbers;
  - `generated_by: "human"`, `status: "draft"`.
- That lets the import, database and app be tested on **real content**, which stays `draft` (invisible to the app).
- To demo the review → publish flow, use `backend/fixtures/mock_export.json`, which has claims and passes the gate, or wait for the Data Lead's pipeline export with claims.

## Conventions
- Python 3.11+, `psycopg` (v3) for DB writes in one transaction via `SUPABASE_DB_URL`; `supabase-py` for Storage uploads; `jsonschema` for validation; `pytest`.
- Every script supports `--dry-run` and prints a summary; it fails loudly on bad input and writes nothing partial.
- SQL changes go in a **new** numbered migration; never edit an applied one.
- IDs: lowercase, digits and hyphens; stable. Lesson IDs look like `psa-<topic>-<nn>`.

## Secrets
- `.env` (git-ignored): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_DB_URL`. Keep `.env.example` with empty values.
- **Never** put the service key or DB URL in code, tests, fixtures, the app, or commits. Tests that act as the app use the anon key only.

## Commands
- Apply migrations: `supabase db push` (or paste them into the Supabase SQL editor)
- Local DB for tests: `supabase start` (Docker), then `supabase db reset`
- Tests: `pytest backend/tests -q`
- Import: `python backend/scripts/import_content.py <export.json> --dry-run`

## Workflow
- Feature branches + pull requests; small commits.
- Tell the Data Lead before changing `schema/content.schema.json` (bump `schema_version`), and Frontend before changing `docs/api-contract.md`.

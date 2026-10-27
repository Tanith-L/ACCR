# Backend (Backend Lead)

Supabase schema plus Python scripts that use the **service key**. The app never sees that key; see [docs/api-contract.md](../docs/api-contract.md).

## First-time setup

1. Create a Supabase project. Copy `.env.example` to `.env` and fill in the URL, service key and anon key.
2. Apply the migration with the Supabase CLI (`supabase link` then `supabase db push`), or paste `supabase/migrations/*.sql` into the SQL editor.
3. Create a **public** Storage bucket `media` and upload `../media/*.jpg`.

## Commands

```bash
.venv/bin/python -m rheumnotes_backend import ../data/output/psa_legacy.json [--dry-run]
.venv/bin/python -m rheumnotes_backend review-sheet            # checked lessons -> review_sheets/review_sheet_YYYYMMDD.csv
.venv/bin/python -m rheumnotes_backend review-import review_sheets/<scored>.csv
.venv/bin/python -m rheumnotes_backend publish [lesson-id ...] # reviewed -> published
.venv/bin/python -m rheumnotes_backend evaluate ../data/output/psa_overview.json

.venv/bin/python -m pytest      # offline mapping tests
npm install && npm run test:sql # migration + RLS tests in in-memory Postgres (PGlite)
```

Review sheet: Dr. Murphy fills `score_*`, `decision` (`pass` / `revise`), `comment` and `reviewer`. Every import, review and publish action is logged to the `content_events` table.

## Already done

- Migration: tables, `content_status` enum, a transition trigger (also freezes reviewed and published content), `v_topics` / `v_subtopics` / `v_lessons`, RLS and column grants. Tested with 8 SQL tests.
- Import (validates first, idempotent, rejects content changes without a version bump), review sheet export and import, publish, and the evaluation script.
- **Not yet run against a real Supabase project.** Expect small fixes on first contact.

## Your Week 9 TODOs

- [ ] Create the project and apply the migration; check that `npm run test:sql` and `evaluate` agree with the live project
- [ ] Confirm the Rubric B criteria and scale with Dr. Murphy (`RUBRIC_B` in `review.py`)
- [ ] Decide where drafts are previewed (the mock app, or a separate Supabase project)
- [ ] Record median and p95 latency from `evaluate`
- [ ] Demo: edit `topics.description` in the Supabase dashboard and reload the app

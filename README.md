# RheumNotes

Patient education app for psoriatic arthritis (PsA), built for ACCR / Dr. Murphy.

```
Educational materials ──► AI pipeline ──► content bundle JSON ──► Supabase ──► patient app
   data/sources/            data/            data/output/           backend/      frontend/
                                  └── validated against shared/schema/content-bundle.schema.json
```

The four parts only meet at two contracts. If you change either one, tell the other leads and update the doc in the same PR.

| Contract | Between | Defined in | Explained in |
|---|---|---|---|
| Content bundle JSON | Data → Backend (and the frontend mock) | [shared/schema/content-bundle.schema.json](shared/schema/content-bundle.schema.json) | [docs/content-schema.md](docs/content-schema.md) |
| Patient API (`v_*` views) | Backend → Frontend | [backend/supabase/migrations/](backend/supabase/migrations/) | [docs/api-contract.md](docs/api-contract.md) |

## Repository layout

| Path | Owner | What's in it |
|---|---|---|
| `topics.yaml`, `lessons/`, `quizzes.yaml`, `media/` | Data | Hand-written PsA content and images (the knowledge structure the pipeline follows) |
| `data/` | Data Lead | Python pipeline: ingest → extract concepts → plan → draft → verify → check → export; validation; evaluation |
| `data/output/psa_legacy.json` | Data Lead | The hand-written content converted to a bundle. The frontend mock reads this file, so keep it committed and valid |
| `shared/` | Data + Backend | JSON Schema for bundles; `fixtures/test_bundle.json` with obviously fake content for tests |
| `backend/` | Backend Lead | Supabase migration (tables, status lifecycle, views, RLS); import / review / publish / evaluation scripts |
| `frontend/` | Frontend Lead | Expo (React Native) app: topic list, learning path, lesson screens |
| `docs/` | Documentation Lead | Architecture, contracts, integration checklist, report templates |

## Setup

Requirements: Python 3.10+, Node 22 (`nvm use` reads `.nvmrc`), and for the backend a Supabase project.

```bash
# Data pipeline
cd data && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m rheumnotes_data convert-legacy        # rebuild data/output/psa_legacy.json
.venv/bin/python -m pytest                                # 9 tests, no API key needed

# Backend
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env                                      # fill in Supabase URL + keys
.venv/bin/python -m pytest                                # mapping tests, offline
npm install && npm run test:sql                           # RLS + status tests in in-memory Postgres

# Frontend
cd frontend && npm install
cp .env.example .env.local                                # mock mode works with no changes
npx expo start                                            # press i / a / w for iOS, Android, web
npm test && npm run typecheck && npm run lint
```

## Content status lifecycle

```
draft ──(fix + re-export as new version)──► checked ──(Rubric B pass)──► reviewed ──(publish)──► published
  ▲ failed an automatic check                 │ passed all checks            Dr. Murphy               visible to patients
  └──────────── "revise" comment ─────────────┘ (stays checked; the fix arrives as a new version)
```

- The pipeline exports only `draft` or `checked`. The schema rejects anything else.
- Only `checked` lessons go on Dr. Murphy's review sheet.
- A database trigger enforces the transitions, so a script bug can't skip a step. Reviewed and published content can't be edited; fixes are new versions.
- The app's anon key can read only `published` rows through the `v_*` views. RLS and column grants enforce this on the server.

## Team workflow

- Branch per feature (`data/…`, `backend/…`, `frontend/…`, `docs/…`), PR into `main`, one reviewer.
- Contract changes (schema, migration, views) need a reviewer from the other side of the contract.
- Never commit keys or patient information. Only the anon key goes in the app; the service key stays in `backend/.env` or GitHub secrets.
- Include tests and setup notes with each feature.

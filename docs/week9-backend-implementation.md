# Week 9 — Backend Implementation (Database & Content Delivery)

Owner: Vanshika Tiwari (Backend Lead) · v1 · Oct 25, 2026 · Status: **SQL drafted and tested locally (Postgres 16); scripts to build**
Related: `backend-implementation-plan.md` (Phase 0–1), `content-json-schema.md`, `backend-architecture.md` (v5), migrations `sql/0001–0003`

## 1. Week 9 goal (backend)
Store the Data Lead's structured content in Supabase, manage its review status, and deliver **only published** content to the app, so that a change in the database shows up in the app without changing app code.

**In scope:** content tables, published views + RLS, import / review / publish scripts, the API contract for Frontend, tests, the evaluation report, and the client demo.
**Not in Week 9:** anonymous sign-in and study tables (Phase 3, before evaluation sessions). **Frontend keeps lesson completion on the device** this week, behind a progress service that will switch to the backend later.

## 2. Repo layout

```
backend/
├── supabase/migrations/
│   ├── 0001_content_schema.sql     ← tables, constraints, versioned lessons
│   ├── 0002_published_access.sql   ← RLS, grants, published views, get_learning_path
│   └── 0003_review_publish.sql     ← apply_review, publish_lesson, rollback_lesson
├── scripts/
│   ├── import_content.py           ← B1
│   ├── review_import.py            ← B2
│   └── publish.py                  ← B3 (publish / rollback / dry-run)
├── tests/                          ← pytest: import, integrity, access, api, errors
├── perf/latency.py                 ← median / p95 per endpoint
├── fixtures/mock_export.json       ← schema-valid sample (1 topic, 3 lessons)
├── docs/api-contract.md            ← shared with Frontend + Documentation Lead
└── .env.example                    ← SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_DB_URL
```
`schema/content.schema.json` sits at the repo root and is shared with the Data Lead.

## 3. Day-by-day plan

| Day | Work | Output |
|---|---|---|
| 1 | Schema sign-off with Lyra; create `rheumnotes-dev`; repo folders; `.env` | Schema v1 committed |
| 2 | Push migrations 0001–0003; run the SQL checks from §9 in Supabase | Database live |
| 3 | `import_content.py` + `mock_export.json`; import tests | Mock content imported |
| 4 | `review_import.py`, `publish.py`; API contract + mock responses to Penelope | Content published; Frontend unblocked |
| 5 | Access, API and error tests; latency script | Test results |
| 6 | Integration: import Lyra's export (if ready); Penelope connects the app | End-to-end flow |
| 7 | Evaluation report; demo rehearsal | Report + demo |

## 4. Database

### 4.1 Tables (migration 0001)

| Table | Purpose | Key rules |
|---|---|---|
| `import_runs` | One row per import | model, prompt version, counts, notes |
| `diseases`, `sources` | Disease; approved source documents | `sources.file_hash` records the exact file used |
| `topics`, `subtopics` | Learning hierarchy | IDs `^[a-z0-9-]+$`; unique `sort_order` within a parent |
| `lessons` | **One row per version**; PK `(id, version)` | 1–4 pages; 1–3 takeaways; est. minutes 1–5; `content_hash`; **at most one published version per lesson** (partial unique index) |
| `lesson_claims` | Claims + source quotes (the credibility evidence) | Per lesson version; `support` and `quote_match` from the pipeline |
| `media`, `lesson_media` | Images and where they appear | Storage path, alt text, credit, source |
| `quiz_items` | Quiz per lesson version | `answer` must be a valid option index |
| `reviews` | Rubric B scores | Scores 1–5; decision `pass` / `revise` |

### 4.2 Status lifecycle

```
draft ──(fix + re-export)──► checked ──apply_review: pass──► reviewed ──publish_lesson──► published
  ▲                              │ revise (stays checked,                                    │
  └──── comment to Data Lead ◄───┘  comment to Data Lead)              new version published ─► archived
                                                                        rollback_lesson ◄──────┘
```

| Change | Who / how | Guard |
|---|---|---|
| → `draft` / `checked` | Import script (from the JSON) | Import re-checks the gate; a "checked" lesson that fails it is imported as `draft` |
| `checked` → `reviewed` | `apply_review()` | Only from `checked`; **the pass rule is enforced in SQL** (Accuracy 5, Safety 5, others ≥ 4, FK grade ≤ 8), not trusted from the sheet |
| `reviewed` → `published` | `publish_lesson()` | Only from `reviewed`; archives the previous published version; publishes its quiz items and parent subtopic/topic |
| `published` → previous | `rollback_lesson()` | Re-publishes the latest archived version |

### 4.3 Access model (migration 0002)
- **RLS is on for every content table, with no policies**, and table grants are revoked from `anon` and `authenticated`. The app cannot read or write base tables at all.
- **The app reads only:**
  - `v_topics`: published topics.
  - `v_lessons`: the published version of each lesson. Patient-facing fields plus images; no claims, checks or run metadata.
  - `v_quiz_items`: quiz items of published lesson versions.
  - `get_learning_path(topic_id)`: published subtopics with their published lessons, in order.
- **The review and publish functions** (migration 0003) are **not executable by anon**. Scripts call them with the service connection.
- **Keys:**
  - The app holds only the **anon key**.
  - The **service key / DB URL** live only in team `.env` files and GitHub secrets.
- **Supabase lint:** the views run as their owner (so they can read past RLS) and filter to `published` themselves. The security advisor flags this pattern as "security definer view"; here it is intentional and covered by the access tests.

**Verified locally (Postgres 16, Supabase-style roles):**

| Test | Result |
|---|---|
| Anon reads `v_lessons` with one published and one draft lesson | 1 row (draft hidden) |
| Anon `select` on `lessons` | `permission denied` |
| Anon `insert` into `topics` | `permission denied` |
| Anon calls `apply_review` / `publish_lesson` | `permission denied` |
| Review a `draft` lesson | Rejected: only checked lessons can be reviewed |
| Publish a `checked` lesson | Rejected: only reviewed lessons can be published |
| Review with all 5s but FK grade 9.5 | `revise`; stays `checked` |
| Publish v2 → v1 archived; rollback → v1 published, v2 archived | As expected |
| Two published versions of one lesson | Blocked by the unique index |

## 5. B1: `import_content.py`

```
python scripts/import_content.py exports/export_psa_20261028_a.json [--dry-run]
```

1. **Validate:**
   - Check the file against `content.schema.json`, plus cross-references (every `*_id` exists; no duplicate IDs; subtopic `lesson_ids` exist).
   - **Any error rejects the whole file.**
2. **Status gate:** re-compute "checked" from `checks`:
   - schema valid,
   - `citation_accuracy = 1`,
   - 0 unsupported and 0 contradicted claims,
   - `numbers_ok`,
   - no safety flags,
   - `fk_grade ≤ 8`.

   If the JSON says `checked` but the gate fails, import it as `draft` and log it.
3. **Versioning per lesson.** `content_hash` = SHA-256 of title, minutes, pages, takeaways, images and quiz items.

   | Latest existing version | Action |
   |---|---|
   | None | Insert version 1 |
   | Same `content_hash` | Skip (re-import is idempotent) |
   | `draft` / `checked` | Update in place; replace its claims, media links and quiz items |
   | `reviewed` / `published` / `archived` | Insert **version + 1**, so the live version stays unchanged until the new one passes review |

   `sort_order` comes from the position in the subtopic's `lesson_ids`.
4. **Topics / subtopics:** upsert the name and order. New rows start as `draft`; published ones stay published.
5. **Images:**
   - Upload to the Storage bucket `media` at path `<media_id>.<ext>`, using upsert so re-runs are safe.
   - Upload **before** the database transaction.
6. **One transaction** (psycopg on `SUPABASE_DB_URL`) for all rows plus the `import_runs` row. If anything fails, roll back.
7. **Report:** inserted / updated / skipped / downgraded counts, written to the console and to `import_runs.notes`.

## 6. B2: `review_import.py`

```
python scripts/review_import.py reviews/rubric_b_2026-10-30.csv --reviewer "Dr. Murphy"
```
- **CSV columns:** `lesson_id, version, accuracy, completeness, readability, safety, terminology, comment`. The `decision` column is ignored, because SQL computes it.
- Each row calls `apply_review()`.
- **Output per lesson:** `reviewed`, `revise`, or an error (not found / not `checked`).
- The **review sheet is generated from `checked` lessons only**, so Dr. Murphy never sees lessons that failed the automatic checks.

## 7. B3: `publish.py`

```
python scripts/publish.py --lesson psa-dx-01 [--version 2] [--dry-run]
python scripts/publish.py --all-reviewed
python scripts/publish.py --rollback psa-dx-01
```
- `--dry-run` prints what would change.
- Every change is logged.
- Publishing is a separate, deliberate step: a team member runs it after the review.

## 8. API contract (for Frontend)

Base: `{SUPABASE_URL}/rest/v1`. Headers: `apikey: <anon key>`, `Authorization: Bearer <anon key>`.

| Screen | Request | Response |
|---|---|---|
| Topic selection | `GET /v_topics?select=id,name,icon,sort_order&order=sort_order` | `[{ "id": "dx", "name": "Understanding diagnosis", "icon": null, "sort_order": 2 }]` |
| Learning path | `POST /rpc/get_learning_path` body `{ "p_topic_id": "dx" }` | `[{ "id": "dx-criteria", "name": "...", "sort_order": 1, "lessons": [{ "id": "psa-dx-01", "title": "...", "est_minutes": 3, "sort_order": 1 }] }]` |
| Lesson | `GET /v_lessons?id=eq.psa-dx-01` | `[{ "id", "version", "title", "est_minutes", "pages": [{order, body}], "key_takeaways": [...], "images": [{ media_id, page, path, alt_text, credit }], "updated_at" }]` |
| Quiz | `GET /v_quiz_items?lesson_id=eq.psa-dx-01` | `[{ "id", "question", "options": [...], "answer", "feedback" }]` |
| Image | `GET {SUPABASE_URL}/storage/v1/object/public/media/<path>` | Image file |

**Errors the app must handle:**

| Case | What the API returns | App behavior |
|---|---|---|
| Unknown or unpublished lesson ID | `200` with `[]` | Empty state |
| Topic with no published subtopics | `[]` from `get_learning_path` | Empty state |
| Malformed filter / bad parameter | `400` (PostgREST error JSON) | Error state, log it |
| Missing or invalid API key | `401` | Error state |
| Network failure / timeout | No response | Retry once, then the error state |

**Content refresh:** fetch on screen open and on pull-to-refresh. `updated_at` and `version` let the app tell when content changed.

**Mock data:** `fixtures/mock_responses/*.json` match these shapes exactly, so Frontend can build before the backend is live.

## 9. Tests (pytest) and Week 9 targets

| Dimension | Test | Target |
|---|---|---|
| Import correctness | Import the mock export; compare every row field-by-field with the JSON; re-import → 0 changes; corrupt file → nothing written | 100% correct |
| Database integrity | SQL checks: orphan rows, duplicate `sort_order`, lessons missing from subtopics, more than one published version | 0 issues |
| Retrieval correctness | Each request in §8 returns the expected shape and order | All pass |
| Access control | With the anon key: read a draft lesson (expect none), read base tables (expect denied), insert/update content (expect denied), call review/publish functions (expect denied) | All refused |
| Response performance | `perf/latency.py`: 50 requests per endpoint from a laptop; note the region and network | Report median and p95 |
| Error handling | Missing ID, bad filter, no API key, timeout simulation | Expected codes, no crashes |
| Content flexibility | Edit a non-clinical field (e.g. a topic name) in the database → reload the app | Change visible, no code change |

## 10. Evaluation report (template)

| Dimension | Result | Target met? | Notes |
|---|---|---|---|
| Data import correctness | x / y records match | | |
| Database integrity | n issues | | |
| Retrieval correctness | x / y tests pass | | |
| Content access control | x / y attempts refused | | |
| Response performance | median __ ms · p95 __ ms per endpoint | | region, network |
| Error handling | x / y cases handled | | |

Also include: what was built, the integration issues found with Data and Frontend, and the next steps (Phase 2).

## 11. Client demo (about 3 minutes)
1. **Show the structure:** topics → subtopics → lessons in the Supabase table view. Point out the `status` column and the claims with source quotes behind each lesson.
2. **Show safety:** a `checked` (not yet published) lesson exists in the database but **does not appear in the app**.
3. **Publish it:** run `publish.py`. It appears in the app on refresh.
4. **Show flexibility:** edit a non-clinical field (a topic name). It changes in the app without any code change.
5. **Key message:** "We are building a content management foundation that allows educational materials to be organized, reviewed, updated and delivered to patients without redesigning the application."

## 12. Risks and open items

| Risk | Mitigation |
|---|---|
| Lyra's export is late or doesn't fit the schema | Build and test on `mock_export.json`; the schema is signed off on day 1 |
| Free-tier project pauses before the demo | Open the dashboard / run a query the day before |
| Draft images are publicly reachable by URL | Week 9: non-clinical images only; decide on a private bucket + signed URLs in Week 10 |
| Supabase flags the views in the security advisor | Intentional; documented here and covered by access tests |
| Sign-in deferred | Progress stays on the device; sign-in + study tables in Phase 3, before participant sessions |

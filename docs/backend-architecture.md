# RheumNotes PsA — Backend Architecture (v5)

Owner: Vanshika Tiwari (Backend Architect Lead) · v5 · Oct 25, 2026 · Status: **draft for Week 9 implementation**
Companion docs: `content-json-schema.md` (Data → Backend contract), `content-pipeline-design.md` (v7), `lyra-content-guide.md` (v3), `signin-privacy-memo.md`, the app-workflow diagrams.

## Changes from v4 (Week 9 plan, Oct 25)
- **Content moves into Supabase Postgres tables**, with a `status` column (`draft → checked → reviewed → published`). This replaces the Git files → JSON bundle approach. Patients read **published rows only**, enforced by RLS.
- **The LLM writes lessons**, and a credibility evaluation gates them (see the pipeline doc). **The Data Lead owns the Python pipeline**, which exports JSON in the shared schema.
- **The backend owns:**
  - the import script (JSON → tables);
  - status management;
  - the retrieval API;
  - access control;
  - the study tables.
- **Lesson completion is stored in the backend:** anonymous sign-in plus the `progress` table.
- **The offline bundle is now future work:** an optional export of the published rows.

Carried over: no admin web page, no Rubric A, Rubric B + grade-8 check, no study arms, no PHI. Mind map, shared care-team block and glossary remain future work.

---

## 1. Purpose and constraints
The backend **stores structured educational content, manages its review status, delivers published content to the app**, and stores **non-PHI study data** for the evaluation.

| Constraint | How it's met |
|---|---|
| Proof of concept | Supabase managed services; no custom server |
| No PHI, EHR or personalized advice | Anonymous sign-in, no free text on the server, education-only content |
| Content can change without app changes | The app fetches content from the database at run time |
| AI content must be credible | Only `published` rows are visible; publishing requires the automatic checks + Dr. Murphy's Rubric B pass |
| Free services | Supabase free tier |
| Scalable to more diseases | `disease_id` on every content row; content is data, not code |

## 2. Frontend requirements → backend support

| App feature | Backend support |
|---|---|
| Sign in (Face ID requested) | Supabase anonymous session; Face ID unlocks it on the device. Access code still pending |
| Topic selection | `GET topics` (published), ordered |
| Learning path (subtopics → lessons) | `GET subtopics` with nested lessons (titles, order, minutes) |
| Lesson screen | `GET lesson` by id: pages, takeaways, images, sources |
| Mark lesson complete / progress indicator | `POST progress` (upsert); `rpc my_progress_summary` |
| Optional quiz | `GET quiz_items` by lesson; `POST quiz_attempts / quiz_answers` |
| Bookmarks | `GET / POST / DELETE bookmarks` |
| "When to contact the care team" | A regular published topic |
| Loading / empty / error states | Consistent JSON error format (§7) |
| Evaluation | Events, assessments, CSV export |

## 3. System context

```
 DATA LEAD (offline)                     SUPABASE (free tier)                                 CLIENTS
 ───────────────────                     ────────────────────                                 ───────
 Approved PDFs/DOCX                       Postgres · CONTENT tables (status column)            iOS app (React Native / Expo)
   │                                       topics · subtopics · lessons · claims ·              · topic → path → lesson
 Python pipeline P1–P6 ── export JSON ──►  sources · quiz_items · media · reviews     ──read──► · progress, quiz, bookmarks
  (LLM draft + credibility checks)         ▲ import script (service key)              (published · event queue
                                           │                                           only, RLS)
 Rubric B sheet (Dr. Murphy) ── review ────┘ status → reviewed → published
                                          Postgres · STUDY tables (RLS: own rows)  ◄─write─  Website (can read the
                                          Auth (anonymous) · Storage (images)                 same published API)
                                                   └─► CSV export → evaluation
```

**Two planes, one database:**
1. **Content:** written only by the import scripts (service key). Clients get read-only access to `published` rows.
2. **Study data:** per-user writes, limited to each participant's own rows.

## 4. Components

| Component | Responsibility | Owner | Technology |
|---|---|---|---|
| Content pipeline (P1–P6) | Ingest sources → LLM draft → credibility checks → readability → JSON export + review sheet | **Data Lead** | Python, LLM, jsonschema, textstat |
| JSON schema | Contract between pipeline and import | Data + Backend | JSON Schema in the repo |
| Import script (B1) | Validate the file → upsert content rows in one transaction → log the run | **Backend** | Python + supabase-py (service key) |
| Review import + publish (B2) | Read the Rubric B sheet → set `reviewed` / `needs_revision`; publish step sets `published` | **Backend** | Python script |
| Supabase Postgres | Content tables + study tables, RLS, views, RPCs | Backend | Managed |
| Supabase Auth | Anonymous sessions | Backend | Built in |
| Supabase Storage | Lesson images | Backend | Public bucket (published media only) |
| Retrieval API | Auto-generated REST (PostgREST) over the published views | Backend | Built in |
| iOS app | Central content service; renders the API data | Frontend | React Native (Expo) |

## 5. Data model

### 5.1 Content plane

| Table | Key fields |
|---|---|
| diseases | id, name |
| sources | id, title, type, provided_by, file_hash |
| topics | id, disease_id, name, order, icon, **status** |
| subtopics | id, topic_id, name, order, **status** |
| lessons | id, subtopic_id, title, est_minutes, pages (jsonb), key_takeaways (jsonb), generated_by, checks (jsonb), **status**, version, run_id, updated_at |
| lesson_claims | id, lesson_id, text, page, source_id, source_page, source_quote, support, quote_match |
| lesson_media | lesson_id, media_id, page |
| media | id, file (Storage path), alt_text, credit, source_id |
| quiz_items | id, lesson_id, question, options (jsonb), answer, feedback, source_id, source_page, source_quote, **status** |
| reviews | lesson_id, version, reviewer, accuracy, completeness, readability, safety, terminology, decision, comment, reviewed_at |
| import_runs | run_id, file_name, schema_version, model, prompt_version, rows_inserted / updated, errors, imported_at |

**Status rules:**
- The import can set only `draft` or `checked`. It never overwrites a `published` row in place: a changed lesson gets `version + 1` and goes back to `checked`.
- `reviewed` is set by the review import, and only when the Rubric B result is a pass.
- `published` is set by the publish step, and only from `reviewed`.

**Published views:** `v_topics`, `v_subtopics`, `v_lessons`, `v_quiz_items` expose only `status = 'published'` rows and only patient-facing fields (no claims, checks or run metadata).

### 5.2 Study plane (unchanged)

| Table | Key fields |
|---|---|
| participants | participant_id, user_id (auth.uid), access_code_hash *(optional)*, created_at |
| progress | participant_id, lesson_id, status, pages_seen, updated_at |
| bookmarks | participant_id, lesson_id, created_at |
| quiz_attempts / quiz_answers | attempt_id, participant_id, lesson_id, skipped, score · item_id, chosen_index, correct |
| assessment_responses | participant_id, assessment (pre/post), item_id, chosen_index, correct |
| events | event_id (client-generated), participant_id, session_id, name, screen, target_id, props, client_ts |

## 6. Access control (RLS)
- **Content tables:**
  - `anon` and `authenticated` roles can `select` only rows where `status = 'published'`. The app reads through the published views.
  - There are **no client writes** to content. Writes go through the service key, used only by the import, review and publish scripts on team machines.
- **Drafts and review:**
  - Rows that aren't published are visible only to the service role.
  - A **separate Supabase project** (free tier) can serve as the review/demo environment if reviewers need to see drafts in the app.
- **Study tables:** each participant can select, insert and update only their own rows.
- **Keys:** the app ships only the **anon key**. The service key never goes into the app or Git (`.env`, GitHub secrets).
- **Week 9 test:** using the anon key, try to read a draft lesson and to write a content row. Both must be refused.

## 7. API (Week 9 contract with Frontend)

All reads use the anon key plus the user's session token. Base URL: `/rest/v1`.

| Purpose | Request | Returns |
|---|---|---|
| Topics | `GET /v_topics?select=id,name,icon,order&order=order` | Published topics |
| Learning path | `GET /v_subtopics?topic_id=eq.{id}&select=id,name,order,lessons:v_lessons(id,title,est_minutes,order)&order=order` | Subtopics with nested lessons |
| Lesson | `GET /v_lessons?id=eq.{id}&select=*` | Pages, takeaways, images, version |
| Quiz | `GET /v_quiz_items?lesson_id=eq.{id}` | Questions, options, feedback (answer checked client-side for the PoC) |
| Mark complete | `POST /progress` (upsert on participant_id + lesson_id) | 201 |
| Progress summary | `POST /rpc/my_progress_summary` | Lessons done per topic |
| Bookmarks | `GET / POST / DELETE /bookmarks` | |
| Quiz results | `POST /quiz_attempts`, `/quiz_answers` | |
| Events | `POST /rpc/log_events` (batched, idempotent `event_id`) | |

**Errors (for the frontend's loading, empty and error states):**
- Missing record → empty array (`[]`), shown as the empty state.
- Bad parameter → HTTP 400.
- Expired session → 401, and the app refreshes the session.
- Network error → retry, then the error state.

The Documentation Lead keeps these in the shared API contract file.

**Content updates without app changes:** the app re-queries on screen open and on pull-to-refresh. Editing a published row (for example, a non-clinical title) shows up on the next fetch.

## 8. Identity and privacy
- **Sign-in:** an anonymous session is created on first launch. An access code is optional (decision pending). Face ID unlocks the saved session on the device.
- **Data we never store:** names, emails, symptoms, or diary/checklist text.
- **LLM boundary (Data pipeline):**
  - It receives approved source text only, offline.
  - Only after Dr. Murphy agrees and the provider's data terms are checked.
  - It never receives user data.
- **End of study:** data is exported and then deleted (confirm with Prof. Padman / IRB).

## 9. Evaluation (Week 9 backend targets)

| Dimension | Method | Target |
|---|---|---|
| Import correctness | Compare rows with the JSON (counts + field hashes) | 100% |
| Database integrity | FK constraints + orphan / order queries | 0 invalid relationships |
| Retrieval correctness | Automated tests for each endpoint above | All pass |
| Access control | Anon-key tests: read draft, write content, read another participant's progress | All refused |
| Performance | Time 50 requests per endpoint | Report median and p95 |
| Error handling | Missing IDs, bad params, expired token | Expected codes |

## 10. Future work
- **Offline bundle:** export the published rows to a cached JSON file.
- **Mind map:** map tables plus vision-LLM transcription.
- **Shared care-team guidance block.**
- **Glossary.**
- **Admin web page:** review and publish UI.
- **Rubric A.**
- **Realtime updates.**

## 11. Open decisions

| Item | Owner | When |
|---|---|---|
| JSON schema v1 sign-off | Lyra + Vanshika | Start of Week 9 |
| Rubric B criteria and review format | Dr. Murphy | Before the first review |
| LLM choice + data terms + Dr. Murphy's OK | Lyra | Before the first pipeline run |
| Sign-in: anonymous only vs. access code | Team + Dr. Murphy | Week 9 |
| Separate review project for drafts? | Vanshika | Week 9 |
| IRB / consent for study data | Maggie → Prof. Padman | Before sessions |

## 12. Week 9 plan (backend)
1. Create the Supabase schema: content and study tables, views, RLS, and the `progress` upsert.
2. Write the import script (B1), and test it on a mock JSON file that follows the schema.
3. Write the review import and publish script (B2).
4. Write the API contract and publish a mock response set for Frontend.
5. Run the access-control, retrieval, latency and error tests, and write the evaluation report.
6. **Client demo:** show content in the tables → the app shows it → edit a non-clinical field → the app shows the change.

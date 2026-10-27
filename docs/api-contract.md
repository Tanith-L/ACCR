# Patient API contract (Backend → Frontend)

The app reads three Supabase views through PostgREST with the **anon key**.
Every row they return is `published`. The base tables hold drafts and review data, but RLS and column grants hide them from the anon key.

Base URL: `${SUPABASE_URL}/rest/v1/`
Headers: `apikey: <anon key>`, `Authorization: Bearer <anon key>`

## `v_topics`: topics that have at least one published lesson

| Column | Type | Notes |
|---|---|---|
| `id` | text | stable slug, e.g. `overview` |
| `disease_id` | text | `psa` |
| `name` | text | |
| `description` | text \| null | safe to edit live (for the "nonclinical field" demo) |
| `icon` | text \| null | icon name; frontend falls back to the order number |
| `order_index` | int | display order |
| `updated_at` | timestamptz | |
| `lesson_count` | int | published lessons only |
| `total_minutes` | int | sum of `est_minutes` |

`GET v_topics?select=*&order=order_index.asc`

## `v_subtopics`

`id, topic_id, name, order_index, lesson_count`. Only subtopics with published lessons are returned.

`GET v_subtopics?select=id,topic_id,name,order_index&topic_id=eq.{topicId}`

## `v_lessons`: latest published version of each lesson

| Column | Type | Notes |
|---|---|---|
| `id`, `topic_id`, `subtopic_id` | text | |
| `order_index` | int | order inside the subtopic |
| `version` | int | |
| `title`, `summary`, `body_markdown` | text | body uses paragraphs, `- ` / `1. ` lists, `**bold**` |
| `est_minutes` | int | |
| `key_takeaways` | text[] (jsonb) | |
| `images` | `{file, alt_text, credit, page}[]` | `file` is a key in the public Storage bucket `media` |
| `references` | `{source_id, title, url, pages[]}[]` | source titles are resolved by the view |
| `quiz` | `{id, question, options[], answer, feedback, source_id}[]` | not shown yet in Week 9 |
| `published_at` | timestamptz | |

Learning path: `GET v_lessons?select=id,topic_id,subtopic_id,order_index,title,summary,est_minutes&topic_id=eq.{topicId}`
One lesson: `GET v_lessons?select=*&id=eq.{lessonId}`

## Ordering

The frontend never hard-codes order. A learning path is subtopics sorted by `order_index`, each with its lessons sorted by `order_index` (`frontend/src/content/mappers.ts:buildLearningPath`).

## Errors

| Situation | HTTP | Frontend `ContentError.code` | What the patient sees |
|---|---|---|---|
| Unknown or unpublished id | 200, `[]` | `NOT_FOUND` | "This content is not available right now." |
| No network / timeout (10 s) / 5xx | – / 5xx | `NETWORK` | connection message + Try again |
| Bad or missing anon key | 401/403 | `CONFIG` | "The app is not set up correctly…" |
| Anything else | 4xx | `UNKNOWN` | generic message + Try again |

## What the anon key cannot do

These are tested in `backend/tests/sql/access_control.test.mjs`:

- read any row whose status isn't `published`, even from `lesson_versions` directly
- read `claims`, `check_results`, `review_*`, `run_id`, or the tables `pipeline_runs` and `content_events`
- insert, update or delete anything

## Frontend side

- Types: `frontend/src/content/types.ts` (camelCase). Row-to-type mapping: `frontend/src/content/mappers.ts`.
- Implementations: `supabaseService.ts` (this contract) and `mockService.ts`. The mock builds the same rows from `data/output/psa_legacy.json` and also includes unpublished lessons, which get a preview banner.
- Switch between them with `EXPO_PUBLIC_CONTENT_SOURCE=mock|supabase`.

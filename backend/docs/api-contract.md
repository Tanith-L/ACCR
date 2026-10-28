# RheumNotes API contract (Frontend ↔ Backend)

Owner: Vanshika (Backend Lead) · v1 · Status: **shapes final for Week 9; confirm against the live project once content is published**
Shared with: Penelope (Frontend), Maggie (Documentation)
Mock data: `backend/fixtures/mock_responses/*.json` match the shapes below exactly, so the app can be built before the backend is live.

## 1. Rules for the app
- Use the **anon key only**. The service key and database URL never go in the app.
- Read **only** the four endpoints below plus public images. Base tables are locked, and any other request is refused.
- The app only ever sees **published** content. Draft, checked and reviewed lessons do not exist as far as the API is concerned.
- Lesson completion stays **on the device** for now (no sign-in or progress endpoints in Week 9).

## 2. Base URL and headers

Base: `{SUPABASE_URL}/rest/v1`

```
apikey: <anon key>
Authorization: Bearer <anon key>
Content-Type: application/json      (POST requests only)
```

## 3. Endpoints

| Screen | Request | Mock response |
|---|---|---|
| Topic selection | `GET /v_topics?select=id,name,icon,sort_order&order=sort_order` | `topics.json` |
| Learning path | `POST /rpc/get_learning_path` with body `{ "p_topic_id": "dx" }` | `learning_path_dx.json` |
| Lesson | `GET /v_lessons?id=eq.psa-dx-01` | `lesson_psa-dx-01.json` |
| Quiz | `GET /v_quiz_items?lesson_id=eq.psa-dx-01&order=id` | `quiz_psa-dx-01.json` |
| Image | `GET {SUPABASE_URL}/storage/v1/object/public/media/<path>` | an image file |

All JSON responses are arrays (the learning path is a single array too). Order the lists by the `sort_order` field, not by arrival order.

### 3.1 Topics: `GET /v_topics`
```json
[{ "id": "dx", "name": "Understanding diagnosis", "icon": null, "sort_order": 2 }]
```
- `icon` can be `null`. Show a default icon until the icon names are agreed.
- Only published topics are returned. A topic is published together with its first published lesson.

### 3.2 Learning path: `POST /rpc/get_learning_path`
```json
[{
  "id": "dx-criteria", "name": "How PsA is recognized", "sort_order": 1,
  "lessons": [
    { "id": "psa-dx-01", "title": "How doctors diagnose PsA", "est_minutes": 3, "sort_order": 1 },
    { "id": "psa-dx-02", "title": "Nail and finger clues",    "est_minutes": 2, "sort_order": 2 }
  ]
}]
```
- Only subtopics that have published lessons are listed. Lessons are in reading order.
- An unknown topic ID, or a topic with nothing published, returns `[]`.

### 3.3 Lesson: `GET /v_lessons?id=eq.<lesson id>`
```json
[{
  "id": "psa-dx-01", "version": 1, "subtopic_id": "dx-criteria", "sort_order": 1,
  "title": "How doctors diagnose PsA", "est_minutes": 3,
  "pages": [{ "order": 1, "body": "…" }, { "order": 2, "body": "…" }],
  "key_takeaways": ["…", "…"],
  "images": [{ "media_id": "mock-joints", "page": 1, "path": "mock-joints.png", "alt_text": "…", "credit": "…" }],
  "updated_at": "2026-10-28T15:00:00+00:00"
}]
```
- The response is an array with **one** item. Use `[0]`.
- `pages` has 1–4 items; show one page at a time, in `order`. `body` is plain text or simple Markdown.
- `images[].page` says which lesson page the image belongs to. Build the image URL from `path` (see 3.5). Use `alt_text` for accessibility and show `credit` with the image.
- `key_takeaways` has 1–3 items, shown at the end of the lesson.
- `images` is `[]` when the lesson has none.

### 3.4 Quiz: `GET /v_quiz_items?lesson_id=eq.<lesson id>`
```json
[{
  "id": "psa-dx-01-q1", "lesson_id": "psa-dx-01",
  "question": "Is there a single test that confirms PsA?",
  "options": ["Yes", "No"], "answer": 1,
  "feedback": "No. Doctors combine the exam, family history and tests."
}]
```
- `answer` is the index of the correct option, starting at 0. There are 2–4 options.
- `feedback` is shown after the patient answers.
- A lesson can have no quiz items: you get `[]`.

### 3.5 Image: `GET {SUPABASE_URL}/storage/v1/object/public/media/<path>`
- No authentication header is needed. Cache images on the device.
- Week 9 images are non-clinical only; see the open items in the Week 9 plan.

## 4. Errors the app must handle

| Case | What the API returns | App behavior |
|---|---|---|
| Unknown or unpublished lesson ID | `200` with `[]` (`empty.json`) | Empty state |
| Topic with no published subtopics | `200` with `[]` from `get_learning_path` | Empty state |
| Malformed filter or bad parameter | `400` with PostgREST error JSON (`error_400.json`) | Error state, log it |
| Missing or invalid API key | `401` (`error_401.json`) | Error state |
| Network failure or timeout | No response | Retry once, then the error state |

The two error files show the usual shape. The exact text of `message` and `hint` comes from Supabase and may differ, so decide on the HTTP status code and never on the text.

## 5. Refreshing content
- Fetch on screen open and on pull-to-refresh.
- `version` and `updated_at` on a lesson show when its content changed. If either differs from what is cached, replace the cached lesson.
- A lesson that was published and then removed (rolled back or replaced) simply stops appearing. Handle a cached lesson that now returns `[]` by showing the empty state.
- Content can change without an app release. Do not hard-code topic names, lesson titles or counts.

## 6. Changing this contract
Tell the Backend Lead before relying on a field not listed here. The Backend Lead tells Frontend before changing any shape above.

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

## 7. Prepared extension: topic image maps (schema 1.1)

Requires migration `0005_topic_image_maps.sql`; it has not been applied by the content-generation task.
Existing topic/path/lesson responses remain unchanged. A map-aware client can additionally call:

```text
POST /rpc/get_topic_image_map
{"p_topic_id":"symptoms"}
```

Unlike the existing list endpoints, this RPC returns **one object or null**, not an array:

```json
{
  "topic_id": "symptoms",
  "media": {"id":"psa-symptoms-body-map", "path":"psa-symptoms-body-map.jpg", "alt_text":"...", "credit":"..."},
  "image_width": 1152,
  "image_height": 1712,
  "image_sha256": "<64 lowercase hex characters>",
  "hotspots": [
    {"id":"skin", "label":"Skin", "lesson_id":"psa-symptoms-01", "shape":"rect", "bounds":{"x":0.027778,"y":0.24007,"width":0.297743,"height":0.119743}}
  ],
  "updated_at": "<timestamp>"
}
```

`null` means no approved map with available targets; fall back to the ordinary learning-path list.
Imports do not publish maps. Map approval is separate from lesson approval, and changing the map returns it to draft.
Only hotspots targeting currently published lessons in the same topic are returned.
The image is independently reviewable educational content and must be approved as a whole before map publication.

Use normalized coordinates against the uncropped image, preserving its aspect ratio. `polygon` regions use `points: [{x,y}, ...]` instead of `bounds`.
Use hotspot labels for accessibility and provide equivalent lesson links. On activation, open the existing lesson endpoint by `lesson_id`.
The repository's `data/psa/chapter/overview.html` demonstrates the coordinate mapping locally; the mobile app has not been wired to this new RPC by this task.

### Course overview navigation (schema 1.2, migration prepared)

After migration `0006_course_image_maps.sql`, `POST /rpc/get_course_image_map` with `{"p_disease_id":"psa"}` returns one object or null. Its image fields match the topic-map response; the owner field is `disease_id` and hotspots use `topic_id` instead of `lesson_id`. Select a topic, then fetch its learning path or topic map. The public response includes only approved course maps and published topics of that disease with published lessons. Imports reset changed maps to draft and never publish them. Neither migration nor the Expo navigation integration has been executed by this data task.

## 8. Topic map (migration `0007_mind_map.sql`)

Not applied to the project until the Backend Lead confirms; the app should treat a failed or empty response as "no map" and fall back to the topic list. Existing endpoints are unchanged.

```text
POST /rpc/get_mind_map
{"p_disease_id":"psa"}          (body optional; defaults to "psa")
```

Mock response: `mind_map_dx.json`. The backend decides every node and every parent link; the app only draws the list and handles tapping and expanding. It does not build or reorder the hierarchy.

```json
[
  { "id": "root", "parent_id": null, "kind": "root", "label": "Psoriatic arthritis", "sort_order": 0, "lesson_id": null },
  { "id": "topic:dx", "parent_id": "root", "kind": "topic", "label": "Understanding diagnosis", "sort_order": 2, "lesson_id": null },
  { "id": "subtopic:dx-criteria", "parent_id": "topic:dx", "kind": "subtopic", "label": "How PsA is recognized", "sort_order": 1, "lesson_id": null },
  { "id": "lesson:psa-dx-01", "parent_id": "subtopic:dx-criteria", "kind": "lesson", "label": "How doctors diagnose PsA", "sort_order": 1, "lesson_id": "psa-dx-01" }
]
```

- The response is one flat array. It is a tree: each node has one `parent_id`, and only `root` has `null`.
- `kind` is `root`, `topic`, `subtopic` or `lesson`. Node `id` values are prefixed (`topic:`, `subtopic:`, `lesson:`), so they never collide across kinds.
- `lesson_id` is set only on `lesson` nodes. Open the lesson with the existing lesson endpoint (3.3) using that value.
- The list is ordered root, topics, subtopics, lessons. Group the children of a node by `parent_id` and show them in `sort_order`.
- Only published content appears: a subtopic or topic with no published lessons is left out, and nodes appear and disappear as lessons are published or rolled back.
- `[]` means nothing is published for that disease (`empty.json`). There is no `root` node in that case.
- There are no nodes other than the content hierarchy. The map shows no clinical text beyond the topic, subtopic and lesson names.

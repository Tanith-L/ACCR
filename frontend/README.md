# Frontend (Frontend Lead)

Expo SDK 58 + Expo Router (Node 22: run `nvm use` in the repo root). Screens are in `src/app/`; everything else is in `src/`.
The app reads only the API in [backend/docs/api-contract.md](../backend/docs/api-contract.md), with the anon key.

```bash
npm install
cp .env.example .env.local   # mock mode works with no changes
npx expo start               # i / a / w
npm test && npm run typecheck && npm run lint
```

| Path | Purpose |
|---|---|
| `src/app/index.tsx` | Topic selection (`GET v_topics`) |
| `src/app/topic/[topicId].tsx` | Learning path (`POST rpc/get_learning_path`): subtopics → ordered lessons, progress, Start/Continue |
| `src/app/lesson/[lessonId].tsx` | Lesson viewer (`GET v_lessons`): one page at a time, images by `page`, key takeaways on the last page, mark complete, next lesson |
| `src/app/quiz/[lessonId].tsx` | Quiz (`GET v_quiz_items`): 0-based `answer`, feedback after each answer |
| `src/content/` | The only place that fetches data. `api.ts` turns contract responses into app types and handles status codes; `httpTransport.ts` (Supabase) and `mockTransport.ts` (fixtures) send the requests |
| `src/hooks/useAsync.ts` | Loading, error and reload state for every screen |
| `src/components/` | Reusable UI, including `AsyncContent` (loading / error / empty states) |
| `src/progress/` | Lesson completion stored on the device (AsyncStorage), behind one context so Phase 3 can swap in the backend |
| `src/theme.ts` | Design tokens (replace with the Figma values) |

## Content source

- `EXPO_PUBLIC_CONTENT_SOURCE=mock` answers every request from `backend/fixtures/mock_responses/` (topic `dx`, lessons `psa-dx-01`/`02`). When the backend adds a fixture, add an import line in `src/content/mockTransport.ts` (and `src/content/media.ts` for images).
- `EXPO_PUBLIC_CONTENT_SOURCE=supabase` calls the live project. Switching needs only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`, no code change.
- `EXPO_PUBLIC_MOCK_FAIL=network|400|401` makes every mock request fail that way, to check the error states.

## Error and empty states (api-contract.md §4)

| Case | What the app does |
|---|---|
| Unknown or unpublished lesson, topic with nothing published (`200 []`) | Empty state |
| `400` | Error state + `console.warn` (an app bug) |
| `401` / `403`, or missing URL / key | Error state ("not set up correctly") |
| Network failure or timeout (10 s) | Retries once, then error state with Try again |

Every screen fetches on open and on pull-to-refresh. Lessons aren't cached, so a new `version` always shows.

## TODO

- [ ] Match the screens to Figma (colors, type, icons, spacing in `theme.ts` and the components)
- [ ] Topic icons once names are agreed with the Data Lead (project guide §11 #8); until then cards show their position
- [ ] Switch to `supabase` once content is published; check images load from the `media` bucket
- [ ] Usability test with 2–3 internal users

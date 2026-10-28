# Frontend (Frontend Lead)

Expo SDK 58 + Expo Router (Node 22: run `nvm use` in the repo root). Screens are in `src/app/`; everything else is in `src/`.
The app reads only the API in [backend/docs/api-contract.md](../backend/docs/api-contract.md), with the anon key.

```bash
npm install
cp .env.example .env.local   # mock mode works with no changes
npx expo start               # i / a / w
npm test && npm run typecheck && npm run lint
```

Screens follow the Figma prototype ("ACCR Prototype"): a welcome screen, then three tabs.

| Path | Purpose |
|---|---|
| `src/app/welcome.tsx` | First launch: what the app is, include or skip quizzes |
| `src/app/(tabs)/(home)/index.tsx` | Your learning topics (`GET v_topics` + each topic's learning path for the % complete) |
| `src/app/(tabs)/(home)/topic/[topicId].tsx` | Topic: numbered lessons (`POST rpc/get_learning_path`), "Quiz is optional" note |
| `src/app/(tabs)/(home)/lesson/[lessonId].tsx` | Lesson (`GET v_lessons`): one page at a time, images by `page`, key takeaways on the last page, Next lesson / Finish lesson |
| `src/app/(tabs)/(home)/quiz/[topicId].tsx` | Knowledge check for a topic (`GET v_quiz_items` for each lesson): intro → question → answer review |
| `src/app/(tabs)/care.tsx` | When to contact the care team (static clinic guidance) |
| `src/app/(tabs)/settings/` | Settings (quiz preference) and About |
| `src/content/` | The only place that fetches data. `api.ts` turns contract responses into app types and handles status codes; `httpTransport.ts` (Supabase) and `mockTransport.ts` (fixtures) send the requests |
| `src/components/` | Figma building blocks: `AppHeader`, `Card`/`InfoCard`, `Chip`, `Button`, `TabBar`, `Logo`, plus `AsyncContent` (loading / error / empty states) |
| `src/progress/`, `src/preferences/` | Lesson completion and app preferences, stored on the device (AsyncStorage) |
| `src/theme.ts` | Design tokens from Figma: teal palette, Inter type, spacing, radius |

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

- [ ] Topic descriptions under each topic name (Figma) need a `description` column in `v_topics`; until then cards show the lesson count
- [ ] Clinic phone number and hours on the Care Team tab (`src/app/(tabs)/care.tsx`)
- [ ] Citations on the About screen once the content pipeline lists its sources
- [ ] Name and email in Settings once sign-in exists (Phase 3; no PHI on the device before that)
- [ ] Switch to `supabase` once content is published; check images load from the `media` bucket
- [ ] Usability test with 2–3 internal users

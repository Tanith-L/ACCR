# Frontend (Frontend Lead)

Expo SDK 58 + Expo Router. Screens are in `src/app/`; everything else is in `src/`.

```bash
npm install
cp .env.example .env.local   # mock mode works with no changes
npx expo start               # i / a / w
npm test && npm run typecheck && npm run lint
```

| Path | Purpose |
|---|---|
| `src/app/index.tsx` | Screen 1: topic selection |
| `src/app/topic/[topicId].tsx` | Screen 2: learning path (subtopics → ordered lessons, progress, Continue) |
| `src/app/lesson/[lessonId].tsx` | Screen 3: lesson (body, images, takeaways, sources, mark complete, next) |
| `src/content/` | The only place that fetches data: `ContentService` interface, mock + Supabase implementations, row mappers |
| `src/hooks/useAsync.ts` | Loading, error and reload state for every screen |
| `src/components/` | Reusable UI, including `AsyncContent` (loading / error / empty states) |
| `src/progress/` | Lesson completion stored on the device (AsyncStorage) |
| `src/theme.ts` | Design tokens (replace with the Figma values) |

Content source: `EXPO_PUBLIC_CONTENT_SOURCE=mock` reads `../data/output/psa_legacy.json` and shows drafts with a preview banner. `supabase` reads the published views. `EXPO_PUBLIC_MOCK_FAIL=1` makes every mock request fail, for testing error states.

## TODO

- [ ] Match the screens to Figma (colors, type, icons, spacing in `theme.ts` and the components)
- [ ] Switch to `supabase` once the backend is live; check images load from the `media` bucket
- [ ] Usability test with 2–3 internal users
- [ ] Optional: quiz UI (the data is already in `Lesson.quiz`)

# End-to-end integration checklist (Week 9)

Run top to bottom before the client demo. Record pass/fail, date and who ran it; file failures in the issue tracker.

| # | Scenario | How | Expected | Owner |
|---|---|---|---|---|
| 1 | Bundle is valid | `python -m rheumnotes_data validate data/output/<bundle>.json` | 0 schema errors, 0 structure errors | Data |
| 2 | Every lesson traceable | `evaluate` report | 100% lessons cite a source | Data |
| 3 | Import is correct | `rheumnotes_backend import …` then `evaluate` | 100% records match; re-import inserts 0 | Backend |
| 4 | Drafts never reach review | `review-sheet` | only `checked` lessons on the sheet | Backend |
| 5 | Review import | scored sheet with one pass, one revise, one draft row | pass → reviewed; revise stays checked; draft row rejected and logged | Backend |
| 6 | Publish | `publish` | only reviewed → published | Backend |
| 7 | Access control | `npm run test:sql` + `evaluate` access row | anon sees 0 unpublished rows and no internal columns | Backend |
| 8 | App shows backend data | `EXPO_PUBLIC_CONTENT_SOURCE=supabase`, open app | published topics and lessons appear in backend order | Frontend |
| 9 | Content flexibility | edit `topics.description` in Supabase, pull to reload / reopen | change shows without code changes | Backend + Frontend |
| 10 | Patient journey | select topic → path → lesson → mark complete | progress bar updates, persists after app restart | Frontend |
| 11 | Error states | airplane mode; bad lesson id; `EXPO_PUBLIC_MOCK_FAIL=1` | friendly message + Try again, no crash | Frontend |
| 12 | Setup reproducible | a teammate follows README on a clean machine | all three parts run | Documentation |
| 13 | No secrets in repo | `git grep -i "service_role\|sk-ant"` | nothing | Documentation |

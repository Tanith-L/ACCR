# Content bundle schema (Data → Backend)

Source of truth: [shared/schema/content-bundle.schema.json](../shared/schema/content-bundle.schema.json).
Validate any bundle with `python -m rheumnotes_data validate <file>`. The backend importer runs the same validator and refuses invalid bundles.

## Shape

```
bundle
├── schema_version     "1.0"
├── generated_at       ISO time
├── pipeline_run       run_id, mode (ai | legacy | manual), model, prompt_version, timings, token usage
├── disease            { id, name }
├── sources[]          { id, title, file, url, media_type, credit }
├── topics[]           { id, name, order, icon, description,
│   └── subtopics[]      { id, name, order, lesson_ids[] } }      lesson_ids = reading order
└── lessons[]
    ├── id, version, topic_id, subtopic_id, order
    ├── title, summary, est_minutes, body_markdown, key_takeaways[]   patient-facing
    ├── images[]       { file (in media/), alt_text, credit, page }   patient-facing
    ├── source_refs[]  { source_id, pages[], excerpt }  at least one  patient-facing (as "references")
    ├── quiz[]         { id, question, options[], answer, feedback, source_id }
    ├── status         draft | checked
    ├── origin         ai_generated | ai_assisted | human_authored
    ├── claims[]       { text, source_id, page, supported: true|false|null }   internal
    └── checks[]       { name, passed, detail }                                 internal
```

## Rules beyond the JSON Schema

`validate.py` also checks these:

- IDs are unique slugs (`psa-overview-01`) and are never reused for different content.
- Every lesson appears in exactly one subtopic's `lesson_ids`, and its `topic_id`, `subtopic_id` and `order` agree with that position.
- `order` values are 1..n with no gaps at each level.
- Every `source_id` in `source_refs`, `claims` and `quiz` exists in `sources`.
- Image files exist in `media/` (warning only).

## Status: who decides

`checks.py` sets the status. A lesson is `checked` only if every automatic check passes:

| Check | Fails when |
|---|---|
| `has_source_refs` | no source, or a source id that doesn't exist |
| `claims_supported` | no claims extracted, or any claim not verified as supported |
| `images_exist` | an image file is missing from `media/` |
| `readable_length` | average sentence is longer than 25 words |
| `quiz_well_formed` | an answer index is out of range |

The converted hand-written lessons are all `draft` for now because nobody has extracted and verified their claims yet.

## Versioning

- A lesson's `id` is stable; its `version` goes up when its content changes.
- `pipeline.run(previous=...)` does this automatically: unchanged content keeps its version, changed content gets `+1`.
- The backend rejects a bundle that changes content without raising the version, and never edits a reviewed or published version.

## JSON → database mapping

| Bundle | Table.column |
|---|---|
| `disease` | `diseases` |
| `sources[]` | `sources` |
| `pipeline_run` | `pipeline_runs` |
| `topics[]` (`order` → `order_index`) | `topics` |
| `topics[].subtopics[]` | `subtopics` |
| `lessons[]`: id, topic_id, subtopic_id, order | `lessons` (identity and position) |
| `lessons[]`: everything else (`checks` → `check_results`) | `lesson_versions` (one row per version) |

The code is `backend/rheumnotes_backend/importer.py:bundle_to_rows`, and `backend/tests/test_mapping.py` checks it against the migration.

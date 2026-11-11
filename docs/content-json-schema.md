# Content JSON Schema: Data → Backend Contract (v1.3, with v1.0–v1.2 compatibility)

Owners: Lyra (Data Lead, produces), Vanshika (Backend Lead, imports) · v1 · Oct 25, 2026 · Status: **draft; agree before any Week 9 code**
Related: `content-pipeline-design.md` (v7), `backend-architecture.md` (v5)

## Schema 1.1: image-based topic navigation

The validator accepts `schema_version: "1.0"`, `"1.1"`, `"1.2"` and `"1.3"`. Topic image maps require 1.1 or later; course overview maps require 1.2 or later. Typed provenance inside `claims` requires 1.3.
Version 1.0 files must not contain `image_map`; existing lesson, quiz, source, and media definitions are retained.
This extension is prepared in the repository; it has not been deployed to Supabase.

An optional `topics[].image_map` contains:

| Field | Rule |
|---|---|
| `media_id` | Reference an image in the export's existing `media[]` |
| `image_width`, `image_height` | Positive intrinsic pixel dimensions of the final image |
| `image_sha256` | SHA-256 of that exact deployed image, binding coordinates to its bytes |
| `hotspots[]` | One or more clickable regions, ordered for keyboard/list navigation |
| `hotspots[].id` | Unique within this topic map |
| `hotspots[].label` | Nonempty accessible label and equivalent list-link text |
| `hotspots[].lesson_id` | Existing lesson in the same topic; several regions may target one lesson |
| `hotspots[].shape` | `rect` or `polygon` |
| `hotspots[].bounds` | Rect only: normalized `x`, `y`, `width`, `height`; positive size and fully inside the image |
| `hotspots[].points` | Polygon only: at least three normalized `{x,y}` vertices, without repeating the closing vertex |

Coordinates use the full, uncropped, upright image, top-left origin, in the range 0..1.
Render with the original aspect ratio. Convert normalized coordinates into the actual displayed image rectangle, including any letterbox offsets; do not crop with a cover layout.
Never copy one map's coordinates to another image. Replacing the image requires rechecking regions and updating its hash and, preferably, its media ID.

The JSON schema handles shapes and numeric ranges. `validate_export` checks unique region IDs, media and lesson references, topic ownership, rectangles staying inside the image, and distinct/nonzero-area polygon vertices.
The importer also checks the file's actual dimensions and SHA-256. A topic without `image_map` keeps the existing list presentation.

Migration `0005_topic_image_maps.sql` stores maps and adds `get_topic_image_map`.
The importer inserts maps as draft and resets a changed map to draft; legacy exports without maps leave stored maps alone.
Maps require separate clinical/content approval before publication. The public RPC hides unpublished maps and filters targets to published lessons in their own topic.

See `data/psa/chapter/` for 24 draft lessons (12 Symptoms lessons), source correspondence, and an offline preview. Home and five topics use the existing topic/subtopic/lesson structure with no navigation image. Only Symptoms supplies an image map, with one distinct lesson per region. Lesson illustrations remain independent of navigation images.

## 1. Purpose
This is the single format that the Data Lead's Python pipeline **exports** and the backend import script **loads** into Supabase. If both sides follow it, content imports with no manual restructuring (Week 9 plan §1–2).

**Rules**
- One file per export run: `export_<disease>_<yyyymmdd>_<run>.json`, UTF-8.
- IDs are lowercase, use digits and hyphens, and are **stable**. Never rename an ID once it's imported; the backend uses IDs to update rows in place.
- The pipeline may only set `status` to `draft` or `checked`. Only the review import sets `reviewed` and `published`.
- Any change to this schema needs `schema_version` bumped and both leads told (GitHub rule).

## 2. Top-level shape

```json
{
  "schema_version": "1.0",
  "run": { "run_id": "2026-10-28-a", "model": "<llm name>", "prompt_version": "draft-v1", "generated_at": "2026-10-28T15:00:00Z" },
  "disease": { "id": "psa", "name": "Psoriatic arthritis" },
  "sources": [ ... ],
  "topics": [ ... ],
  "lessons": [ ... ],
  "quizzes": [ ... ],
  "media": [ ... ]
}
```

## 3. Objects and fields

### `sources[]`: the approved documents the content comes from
| Field | Type | Req | Rule |
|---|---|---|---|
| `id` | string | ✅ | e.g. `src-psa-onepager` |
| `title` | string | ✅ | e.g. "PsA One-Pager Intro" |
| `type` | enum | ✅ | `pdf` · `docx` · `image` · `web` |
| `provided_by` | string | ✅ | e.g. "Dr. Murphy" |
| `file_hash` | string | ✅ | SHA-256 of the source file, so we know exactly which version was used |

### `topics[]` (with nested subtopics)
| Field | Type | Req | Rule |
|---|---|---|---|
| `id` | string | ✅ | e.g. `dx` |
| `name` | string | ✅ | ≤ 5 words |
| `order` | int | ✅ | Order shown in the app |
| `icon` | string | ⬜ | Name agreed with Frontend |
| `subtopics[].id` / `name` / `order` | | ✅ | `name` ≤ 6 words |
| `subtopics[].lesson_ids` | string[] | ✅ | Lessons in reading order; every ID must exist in `lessons` |

### `lessons[]`
| Field | Type | Req | Rule |
|---|---|---|---|
| `id` | string | ✅ | `psa-<topic>-<nn>`, e.g. `psa-dx-01` |
| `topic_id`, `subtopic_id` | string | ✅ | Must exist |
| `title` | string | ✅ | ≤ 8 words |
| `est_minutes` | int | ✅ | 1–5 |
| `pages[]` | `{order, body}` | ✅ | 1–4 pages; `body` ≤ ~150 words, plain text / simple markdown |
| `key_takeaways` | string[] | ✅ | 1–3 items |
| `images[]` | `{media_id, page}` | ⬜ | `media_id` must exist in `media` |
| `claims[]` | see below | ✅ | Factual assertions, or explicitly typed editorial provenance in schema 1.3 |
| `checks` | see below | ✅ | Results of the credibility checks |
| `generated_by` | enum | ✅ | `llm` · `human` · `llm+edited` |
| `status` | enum | ✅ | `draft` · `checked` |

### `lessons[].claims[]`: the basis of the credibility check

The following assertion format is unchanged. Schema 1.3 additionally permits the provenance format below; it does not count as checked assertion evidence.
| Field | Type | Req | Rule |
|---|---|---|---|
| `id` | string | ✅ | `<lesson id>-c<n>` |
| `text` | string | ✅ | One single-fact statement as written in the lesson |
| `page` | int | ✅ | Lesson page it appears on |
| `source_id` | string | ✅ | Must exist in `sources` |
| `source_page` | int | ✅ | Page in the source document |
| `source_quote` | string | ✅ | Exact sentence(s) from the source that support it |
| `support` | enum | ✅ | Judge label: `supported` · `unsupported` · `contradicted` |
| `quote_match` | number | ✅ | 0–1 fuzzy-match score of `source_quote` against the source text |

### Schema 1.3: editorial provenance in `lessons[].claims[]`

The current library exports one record per lesson:

```json
{
  "id": "psa-dx-01-c1",
  "kind": "provenance",
  "references": [
    {"id": "niams-care", "title": "NIAMS: Diagnosis, Treatment, and Steps to Take", "url": "https://www.niams.nih.gov/health-topics/psoriatic-arthritis/diagnosis-treatment-and-steps-to-take"}
  ],
  "source_usage": [
    {"source_id": "src-psa-one-pager-intro", "pages": [1, 2], "kind": "text", "locator": "Box A and Box B", "contribution": "Which findings a clinician checks.", "limits": "Not a standalone diagnostic rule."}
  ]
}
```

`references` resolves canonical reference IDs into titles and URLs; it may be empty. `source_usage` preserves every canonical source-use record. Its `pages` are **lesson pages**, not physical source pages. `locator` can identify a heading or DOCX paragraph; `contribution` and `limits` are editorial explanations, not verbatim quotations. Reference IDs belong to the bibliographic list, while source-use IDs must resolve to export `sources`.

Provenance records intentionally omit assertion `text`, `source_page`, `source_quote`, `support` and `quote_match`. They cannot promote a lesson to `checked`, even when its numeric checks are set to passing values. References and source usage alone do not verify every factual statement.

Apply `backend/supabase/migrations/0008_lesson_provenance.sql` before importing schema 1.3. The importer stores typed records losslessly in private `lessons.provenance` JSONB; assertion rows remain in `lesson_claims`. Both participate in the existing evidence hash through the export's `claims` array. Old exports still import without migration 0008; on migrated databases, updating with an old export clears prior provenance. The public API is unchanged.

### `lessons[].checks`
| Field | Type | Rule |
|---|---|---|
| `schema_valid` | bool | Must be `true` to export |
| `citation_accuracy` | number | Share of claims with `quote_match` ≥ 0.9 |
| `claims_total` / `supported` / `unsupported` / `contradicted` | int | From the judge |
| `numbers_ok` | bool | Every number in the lesson appears in a cited source quote |
| `safety_flags` | string[] | Advice wording, dosing, brand names, diagnosis language (empty = clean) |
| `fk_grade` / `smog` | number | Reading grade of the final text; target ≤ 8 |
| `coverage` | number \| null | Share of the hand-listed key concepts for this source that are present (null if no list) |

**`checked` is allowed only when:** `schema_valid` is true, `contradicted = 0`, `unsupported = 0`, `citation_accuracy = 1.0`, `numbers_ok` is true, `safety_flags` is empty, and `fk_grade ≤ 8`. Anything else stays `draft`.

### `quizzes[]`
| Field | Type | Req | Rule |
|---|---|---|---|
| `id` | string | ✅ | `<lesson id>-q<n>` |
| `lesson_id` | string | ✅ | Must exist |
| `question` | string | ✅ | ≤ 25 words |
| `options` | string[] | ✅ | 2–4 options |
| `answer` | int | ✅ | Index of the correct option, starting at 0 |
| `feedback` | string | ✅ | 1–2 sentences |
| `source_id`, `source_page`, `source_quote` | | ✅ | Same rule as claims |
| `status` | enum | ✅ | `draft` · `checked` |

### `media[]`
| Field | Type | Req | Rule |
|---|---|---|---|
| `id` | string | ✅ | e.g. `psa-joints` |
| `file` | string | ✅ | PNG/JPG, < 500 KB, shipped next to the JSON |
| `alt_text` | string | ✅ | ≤ 20 words |
| `credit` | string | ✅ | |
| `source_id` | string | ✅ | Must exist |

## 4. Example (one lesson, shortened)

```json
{
  "id": "psa-dx-01", "topic_id": "dx", "subtopic_id": "dx-criteria",
  "title": "How doctors diagnose PsA", "est_minutes": 3,
  "pages": [{ "order": 1, "body": "There is no single test for PsA. Doctors look at your joints, skin, nails and X-rays together…" }],
  "key_takeaways": ["There is no single test for PsA."],
  "claims": [{
    "id": "psa-dx-01-c1", "text": "There is no single test for PsA.", "page": 1,
    "source_id": "src-psa-onepager", "source_page": 1,
    "source_quote": "…", "support": "supported", "quote_match": 0.97
  }],
  "checks": { "schema_valid": true, "citation_accuracy": 1.0, "claims_total": 6, "supported": 6, "unsupported": 0, "contradicted": 0,
              "numbers_ok": true, "safety_flags": [], "fk_grade": 6.8, "smog": 8.0, "coverage": 0.83 },
  "generated_by": "llm", "status": "checked"
}
```

## 5. Validation
- The schema is published as `schema/content.schema.json` (JSON Schema draft 2020-12) in the shared repo.
- The **pipeline** validates every record before export (Week 9 target: 100% valid).
- The **import script** validates again and rejects the whole file on any error, so nothing is ever half-imported.
- Cross-reference checks on both sides: every `*_id` points to an existing object, every subtopic lesson exists, no duplicate IDs.

## Schema 1.2: course overview

Optional root `course_map` uses the same image dimensions, hash, rect/polygon geometry as topic maps, but every hotspot requires `topic_id` and forbids `lesson_id`. It must cover every exported topic exactly once. Versions 1.0 and 1.1 cannot include this field. Existing topic maps still require lesson targets within their topic. The full navigation is course -> topic -> lesson; GRAPPA describes disease domains inside a lesson.

Current preview: `data/psa/chapter/overview.html`. Text generation rejects any page/takeaway maximum FK score >= 8. Original-poster text is preserved and not included in this text metric.

## Optional-image framework

No placeholder image, blank media ID, or null image map is needed. Omit `course_map` for the normal six-topic home. Omit `topics[].image_map` for a topic list. `lessons[].images` is also optional; `media` may be an empty array when no images are used. Map internals remain required whenever a map is provided. This remains schema 1.2; no new database migration is needed for omission.

The current Symptoms map keeps its image bytes and geometry. Its 12 regions have 12 distinct lessons: skin (01), eyes (02), changes over time (03), gut (04), shoulders (05), hands/nails (06), feet/attachments (07), spine/SI (08), elbows (09), hips (10), knees (11), ankles (12). Existing draft 01 and 02 were narrowed; their other material moved into the new lessons. No live lesson records, user progress or published content were migrated.

Importer omission preserves any previously stored map; removing a map already published to a database needs an explicit unpublish/remove operation. This task changes local exports and preview only.

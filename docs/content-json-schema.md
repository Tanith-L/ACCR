# Content JSON Schema: Data → Backend Contract (v1)

Owners: Lyra (Data Lead, produces), Vanshika (Backend Lead, imports) · v1 · Oct 25, 2026 · Status: **draft; agree before any Week 9 code**
Related: `content-pipeline-design.md` (v7), `backend-architecture.md` (v5)

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
| `claims[]` | see below | ✅ | Every factual statement in the lesson |
| `checks` | see below | ✅ | Results of the credibility checks |
| `generated_by` | enum | ✅ | `llm` · `human` · `llm+edited` |
| `status` | enum | ✅ | `draft` · `checked` |

### `lessons[].claims[]`: the basis of the credibility check
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

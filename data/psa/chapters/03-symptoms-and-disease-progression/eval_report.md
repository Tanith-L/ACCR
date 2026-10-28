# Week 9 content processing evaluation

Run: `psa-20261028-102126-assisted`

Drafted and assessed by the same interactive assistant, then assembled and validated locally.

Scope: one PsA topic, two draft lessons and six questions. Clinical approval is not recorded.

| Dimension | Result | Interpretation |
|---|---|---|
| Schema validity | 100% of exported records valid | Existing backend schema and references validated |
| Source-faithfulness | 20 claims; 0 unsupported, 0 contradicted | AI assessment against supplied sources, not independent clinical review |
| Traceability | All 20 claims and 6 quizzes have matching source quotes | Exact text matching plus assistant inspection of original images |
| Structure | Zero broken relationships | Stable IDs, lesson membership and page order |
| Concept coverage proxy | 11/12 (91.7%) | AI-editorial reference list fixed before drafting; not a human gold standard |
| Python processing time | 0.693 seconds | Local Python assembly and validation only; interactive drafting was not timed. |
| LLM request time | Not measured; no successful generation API calls | No manual-time saving is inferred |
| Correction effort | 0 recorded interactive content corrections | Human correction effort remains unmeasured |
| Manual comparison | Not measured | Record manual structuring and AI-draft correction time using the same acceptance criteria |

## Reading level

Scores cover each lesson page, the takeaways and each quiz. The values below are maxima across those units; source quotations are reviewer evidence and are excluded. Titles are checked for length and plain language.

| Lesson | Maximum FK | Maximum available SMOG | Status |
|---|---:|---:|---|
| psa-symptoms-01 | 4.96 | 7.55 | draft |
| psa-symptoms-02 | 4.35 | 6.74 | draft |

SMOG on 3-29 sentences is approximate; samples below 3 sentences are not scored. Formula scores do not prove comprehension or clinical safety.

## Concept coverage

| Lesson | Concept | Covered | Evidence or gap |
|---|---|---|---|
| psa-symptoms-01 | skin | yes | psa-symptoms-01-c2: Silvery skin scales are explicitly taught. |
| psa-symptoms-01 | nails | yes | psa-symptoms-01-c3: Nail pitting is taught; lifting is an alternative example in the reference concept. |
| psa-symptoms-01 | digits | yes | psa-symptoms-01-c4: Whole-finger or whole-toe swelling is explicit. |
| psa-symptoms-01 | joints | yes | psa-symptoms-01-c5: Swollen hand joints are an example of joints away from the spine. |
| psa-symptoms-01 | back | partial/missing | psa-symptoms-01-c6: Back pain and stiffness are taught, but the draft does not separately teach nearby joint involvement. |
| psa-symptoms-01 | attachments | yes | psa-symptoms-01-c7, psa-symptoms-01-c8: Inflamed tendon or ligament attachments and a foot example are taught. |
| psa-symptoms-02 | eyes | yes | psa-symptoms-02-c2: All three eye symptoms are taught. |
| psa-symptoms-02 | gut | yes | psa-symptoms-02-c3, psa-symptoms-02-c4: Pain, bloating and changed bowel habits are taught. |
| psa-symptoms-02 | shoulder | yes | psa-symptoms-02-c5: Shoulder pain and inflammation are taught. |
| psa-symptoms-02 | hip | yes | psa-symptoms-02-c6: Hip pain and limited movement are taught. |
| psa-symptoms-02 | knee | yes | psa-symptoms-02-c7: All three knee symptoms are taught. |
| psa-symptoms-02 | ankle | yes | psa-symptoms-02-c8, psa-symptoms-02-c9: Ankle/midfoot symptoms and walking difficulty are taught. |

## Provenance and remaining review

- Model provenance: Codex interactive assistant (API model snapshot unavailable)
- Prompt version: psa-interactive-v1
- Python: 3.13.7; packages: {"textstat": "0.7.13", "nltk": "3.10.4", "httpx": "0.28.1", "jsonschema": "4.26.0", "pypdf": "6.9.1", "PyYAML": "6.0.3"}
- Source transcriptions, drafted text and individual assessments are maintained in data/psa/assisted-input/symptoms.json. This run does not claim independent judge calls.
- Source IDs, original file hashes and exact quotes are preserved. For an image, source page 1 means that single original image.
- Human concept identification, source approval, clinical Rubric B scores, judge calibration and manual timing are still pending. Backend checks.coverage remains null until a human reference set exists.
- For a manual comparison, separately record editor, task, active minutes and correction count for manual structuring and AI-draft correction.
- Original sources may contain errors; matching them is not independent evidence of current clinical accuracy.
- The sample does not establish a disease-progression timeline. No reviewed/published status or database write is performed.

## Validation and demonstration

Validate: python pipeline/validate_content.py data/psa/chapters/03-symptoms-and-disease-progression
Backend dry run: python backend/scripts/import_content.py data/psa/chapters/03-symptoms-and-disease-progression/psa-symptoms-and-disease-progression.json --dry-run --media-dir data/psa/chapters/03-symptoms-and-disease-progression

For the client demonstration, open an original poster beside the corresponding lesson Markdown. Follow a claim to its quote and then show the results above.

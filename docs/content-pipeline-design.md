# Content Pipeline, Credibility Checks & Rubric B (v7)

Owner: **Lyra (Data Lead)** · Backend contract: Vanshika · Review: Dr. Murphy (Rubric B) · v7: Oct 25, 2026 · Status: **draft for Week 9**
Companion: `content-json-schema.md` (Data → Backend contract), `backend-architecture.md` (v5), `lyra-content-guide.md` (v3)

## What changed from v6 (Week 9 plan, Oct 25)
1. **The LLM writes the lessons.** It no longer just simplifies hand-written text: it drafts lesson titles, pages, takeaways and quizzes from Dr. Murphy's approved materials.
2. **A credibility evaluation is added.** Every claim must cite a source quote, and automatic checks (citation match, claim support, numbers, safety, readability, coverage) run before anything can be reviewed.
3. **The Data Lead owns the Python pipeline.** It ends with a validated JSON export. The backend imports that JSON into **Supabase content tables**, which replace the Git-files → bundle approach.
4. **Status lives in the database:** `draft → checked → reviewed → published`. Patients see only `published`.

## 1. Pipeline overview

```
DATA LEAD (Python pipeline)                                           BACKEND (Supabase)
───────────────────────────                                           ──────────────────
P1 ingest sources (PDF/DOCX → text + page markers, file hash)
P2 LLM draft lessons + quizzes → JSON with claims + source quotes
P3 schema validation (retry once, else drop)
P4 credibility checks (citation · claim support · numbers · safety · coverage)
P5 readability FK/SMOG ≤ 8 (if > 8: LLM simplifies same facts → rerun P4)
P6 export JSON (draft / checked) + review sheet + eval report ──► B1 import (service key) → content tables
                                                                  Dr. Murphy scores Rubric B (sheet)
                                                                  B2 import review → reviewed → published
                                                                  App reads published rows only (RLS)
```

## 2. Pipeline stages (Data Lead)

| # | Stage | What it does | Tool |
|---|---|---|---|
| P1 | Ingest | Converts approved PDFs/DOCX to text with `[p.N]` page markers; registers each source with a file hash. Tables are kept, images listed for the media step | Python (pdfplumber / python-docx) |
| P2 | LLM draft | Per section of a source, the LLM fills the schema: lesson title, 1–4 pages, takeaways, quiz items, and **for every factual sentence a claim with `source_id`, `source_page` and an exact `source_quote`**. Prompt: write at grade ≤ 8, use only the given text, no advice. Temperature 0, versioned prompt, structured JSON output | LLM |
| P3 | Schema validation | Validate against `content.schema.json` + cross-reference IDs. Retry once with the error message; otherwise drop the item and log it | jsonschema |
| P4 | Credibility checks | See §3. Sets `checks` and the per-claim `support` label | Python + judge LLM |
| P5 | Readability | Flesch-Kincaid (main) + SMOG per page. If > 8, the LLM rewrites the **same claims** more simply (max 2 retries) and P4 runs again. Still > 8 → flagged for a manual rewrite | textstat |
| P6 | Export | JSON file (per the schema) + `review_sheet.csv` for Dr. Murphy + `eval_report.md` with the metrics in §5 | Python |

Items that pass every automatic gate get `status: checked`; everything else stays `draft` with its flags.

## 3. Credibility evaluation

**Layer 1: automatic, on every lesson and quiz item**

| Check | How | Gate |
|---|---|---|
| **Citation match** | Fuzzy-match each `source_quote` against the extracted source text | `quote_match ≥ 0.9` for every claim |
| **Claim support** | A **separate judge prompt** (different from the drafting prompt; temperature 0) reads each claim + its quoted passage and labels it `supported` / `unsupported` / `contradicted`, quoting its evidence | 0 unsupported, 0 contradicted |
| **Uncited facts** | Sentences in the lesson that state a fact but map to no claim | 0 |
| **Numbers** | Every number, % or range in the lesson appears in a cited quote | All match |
| **Safety** | Pattern list + judge: advice wording ("you should take/stop"), dosing, brand names, diagnosis language ("this means you have") | No flags |
| **Readability** | FK and SMOG per page | ≤ 8 |
| **Coverage** | Compare the lesson's concepts with a hand-listed set of key concepts per source (made by Lyra for the evaluation set) | Reported (no gate) |
| **Schema / structure** | JSON Schema + ID references + lesson order | 100% valid, 0 broken links |

**Layer 2: human, required before publishing**
- **Lyra** spot-checks flagged items and a random 20% of `checked` claims against the source. She can edit (`generated_by: llm+edited`) and re-run the checks.
- **Dr. Murphy** scores each lesson with **Rubric B** on the review sheet. Only a pass moves a lesson to `reviewed`. Publishing is a separate step done by the team.

**Calibrating the judge:** Dr. Murphy (or Lyra, for Week 9) labels 20–30 claims by hand. Report agreement with the judge (Cohen's kappa) and the judge's miss rate on unsupported claims. This tells us how far the automatic layer can be trusted.

## 4. Rubric B (Dr. Murphy) *(criteria to confirm)*

| Criterion | 1 – Fail | 3 – Needs work | 5 – Ready |
|---|---|---|---|
| **Accuracy** | Medical meaning wrong | Minor imprecision | Fully correct and faithful to the source |
| **Completeness** | Key point missing | Minor gap | Nothing important missing |
| **Readability** (human) | Confusing | Understandable with effort | Clear and natural for a patient |
| **Safety** | Advice or implied diagnosis | Borderline wording | Education only, points to the care team where needed |
| **Terminology** | Terms undefined or inconsistent | Mostly defined | Defined on first use and consistent |

**Pass rule (proposed):** Accuracy = 5, Safety = 5, all others ≥ 4, and formula grade ≤ 8.

**Review sheet columns:** `lesson_id, title, page_text, claims_with_quotes, fk_grade, flags, accuracy, completeness, readability, safety, terminology, decision (pass / revise), comment`

## 5. Metrics (Week 9 evaluation report)

| Dimension | Metric | Week 9 target |
|---|---|---|
| Schema validity | % records valid | 100% |
| Information accuracy | Unsupported + contradicted claims after review | 0 in the reviewed sample |
| Citation accuracy | % claims with a verified quote | 100% |
| Content coverage | % key concepts present | Report |
| Readability | FK / SMOG before (source) vs. after (lesson) | ≤ 8 |
| Source traceability | % lessons where every claim links to a source | 100% |
| Structural consistency | Broken IDs / order errors | 0 |
| Judge reliability | Kappa vs. human labels; miss rate | Report |
| AI efficiency | Minutes and edits per lesson vs. writing by hand | Report |
| Clinical review | Rubric B pass rate; share passed without edits | Report |

## 6. Rules
1. Only Dr. Murphy's approved materials go in, and only **after he agrees to LLM processing and the provider's data terms are checked**.
2. Every factual sentence is a claim with a source quote; no uncited facts.
3. The LLM uses only the given text; nothing from its own knowledge.
4. Grade ≤ 8 for patient-facing text.
5. Treatment content covers categories, goals and monitoring. No dosing, ranking, brand names (pending Dr. Murphy) or personal advice.
6. The pipeline can set only `draft` or `checked`; only the Rubric B review sets `reviewed`; publishing is a separate team step.
7. Every run records the model, prompt version, source hashes and all check results.
8. Never commit credentials or patient information.

## 7. Week 9 scope
One PsA topic, 2–3 lessons + quizzes, exported as JSON, imported into Supabase, reviewed, and shown in the app.

## 8. Future work
- **Mind map:** vision-LLM transcription of Dr. Murphy's drawings → map tables.
- **Shared care-team guidance:** a single ACCR-approved block.
- **Glossary:** tap-to-define terms.
- **Admin page:** a review UI instead of the sheet.
- **Offline bundle:** an export of the published rows.
- **Rubric A:** source screening.

# Data pipeline (Data Lead)

Turns PsA source documents into a validated content bundle (see [docs/content-schema.md](../docs/content-schema.md)).

```bash
.venv/bin/python -m rheumnotes_data convert-legacy                    # topics.yaml + lessons/ -> output/psa_legacy.json
.venv/bin/python -m rheumnotes_data run --topic overview sources/*.pdf # AI run -> output/psa_overview.json (+ .trace.json)
.venv/bin/python -m rheumnotes_data validate output/psa_overview.json
.venv/bin/python -m rheumnotes_data evaluate output/psa_overview.json \
    --manual-concepts eval/manual_concepts.yaml --manual-minutes 90   # -> output/psa_overview.eval.md
.venv/bin/python -m pytest
```

`run` calls the Claude API (`claude-opus-5-5`). Set `ANTHROPIC_API_KEY` or sign in with `ant auth login` first. Each run makes about 2 + 2×lessons calls.

## Modules

| File | Purpose |
|---|---|
| `ingest.py` | PDF / Markdown / text → `SourceDocument` with per-page text |
| `generator.py` | `ContentGenerator` interface + `ClaudeGenerator` (structured outputs via Pydantic models) |
| `prompts/*.md` | Prompts; bump `PROMPT_VERSION` in `generator.py` when you edit one |
| `pipeline.py` | Orchestration: concepts → plan → drafts → claim verification → checks → bundle |
| `checks.py` | Automatic checks that decide `draft` vs `checked` |
| `validate.py` | Schema + structural validation (also used by the backend importer) |
| `legacy.py` | Converts the hand-written content at the repo root |
| `evaluate.py` | Week 9 evaluation report |

## Already done

- Schema, validator and checks, with tests
- Legacy conversion (6 topics, 15 lessons, 10 sources, all valid; all `draft` because no claims have been extracted yet)
- AI pipeline wired end to end and tested with a fake generator. It has **not been run against the real API yet**.

## Your Week 9 TODOs

- [ ] Put the source PDFs for one topic in `sources/` and do a real `run`; tune the prompts
- [ ] Map `media/media.yaml` images onto generated lessons (`pipeline.py`, `TODO(data)`)
- [ ] Fill `eval/manual_concepts.yaml` by hand and record the human accuracy review in `eval/accuracy_review.csv`
- [ ] Time the manual structuring for the efficiency comparison
- [ ] Decide with Dr. Murphy whether the legacy lessons should get claims extracted so they can become `checked`

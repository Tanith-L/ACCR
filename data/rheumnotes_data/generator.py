"""LLM steps of the pipeline.

`ContentGenerator` is the interface the pipeline depends on. `ClaudeGenerator`
implements it with the Anthropic API; tests use a fake. Prompts live in
prompts/*.md so they can be edited and versioned without touching code.
"""
from __future__ import annotations

import base64
from pathlib import Path
from typing import Protocol

import anthropic
from pydantic import BaseModel, Field

from .ingest import SourceDocument

PROMPT_DIR = Path(__file__).parent / "prompts"
PROMPT_VERSION = "2026-10-27.1"  # bump whenever a prompt file changes
DEFAULT_MODEL = "claude-opus-5-5"


# ---------- structured outputs ----------

class Concept(BaseModel):
    name: str = Field(description="Short name of the educational concept")
    explanation: str = Field(description="One or two sentences, faithful to the source")
    source_id: str
    page: int | None = Field(description="1-based page in the source, if known")
    quote: str | None = Field(description="Short verbatim excerpt that supports the concept")


class ConceptList(BaseModel):
    concepts: list[Concept]


class LessonPlanItem(BaseModel):
    subtopic_id: str
    title: str
    concept_names: list[str]


class LessonPlan(BaseModel):
    lessons: list[LessonPlanItem]


class DraftClaim(BaseModel):
    text: str
    source_id: str
    page: int | None


class DraftQuizQuestion(BaseModel):
    question: str
    options: list[str]
    answer: int
    feedback: str


class LessonDraft(BaseModel):
    title: str
    summary: str
    est_minutes: int
    body_markdown: str
    key_takeaways: list[str]
    claims: list[DraftClaim]
    quiz: list[DraftQuizQuestion]


class ClaimVerdict(BaseModel):
    index: int
    supported: bool
    reason: str


class ClaimVerdicts(BaseModel):
    verdicts: list[ClaimVerdict]


# ---------- interface ----------

class ContentGenerator(Protocol):
    model: str | None

    def extract_concepts(self, doc: SourceDocument) -> list[Concept]: ...

    def plan_lessons(self, topic: dict, concepts: list[Concept], max_lessons: int) -> LessonPlan: ...

    def draft_lesson(self, plan: LessonPlanItem, concepts: list[Concept],
                     docs: list[SourceDocument]) -> LessonDraft: ...

    def verify_claims(self, claims: list[DraftClaim], docs: dict[str, SourceDocument]) -> list[bool]: ...


# ---------- Claude implementation ----------

class GenerationRefused(RuntimeError):
    pass


class ClaudeGenerator:
    def __init__(self, model: str = DEFAULT_MODEL, effort: str = "high"):
        self.client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY / `ant auth login`
        self.model = model
        self.effort = effort
        self.usage = {"input_tokens": 0, "output_tokens": 0}

    def _prompt(self, name: str, **values: str) -> str:
        return (PROMPT_DIR / f"{name}.md").read_text().format(**values)

    def _parse(self, content: list[dict], output: type[BaseModel], system: str):
        with self.client.beta.messages.stream(
            model=self.model,
            max_tokens=64000,
            system=system,
            output_config={"effort": self.effort},
            # On a safety decline, the API retries on a fallback model in the same call.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_format=output,
            messages=[{"role": "user", "content": content}],
        ) as stream:
            response = stream.get_final_message()
        self.usage["input_tokens"] += response.usage.input_tokens
        self.usage["output_tokens"] += response.usage.output_tokens
        if response.stop_reason == "refusal":
            raise GenerationRefused(str(response.stop_details))
        if response.stop_reason == "max_tokens":
            raise RuntimeError("response truncated at max_tokens")
        return response.parsed_output

    @staticmethod
    def _document_block(doc: SourceDocument) -> dict:
        if doc.is_pdf:
            data = base64.standard_b64encode(doc.path.read_bytes()).decode()
            return {"type": "document", "title": f"{doc.id}: {doc.title}",
                    "source": {"type": "base64", "media_type": "application/pdf", "data": data}}
        text = "\n\n".join(f"[page {i}]\n{p}" for i, p in enumerate(doc.pages, start=1))
        return {"type": "document", "title": f"{doc.id}: {doc.title}",
                "source": {"type": "text", "media_type": "text/plain", "data": text}}

    def extract_concepts(self, doc: SourceDocument) -> list[Concept]:
        result = self._parse(
            [self._document_block(doc),
             {"type": "text", "text": self._prompt("extract_concepts", source_id=doc.id)}],
            ConceptList, self._prompt("system"))
        return result.concepts

    def plan_lessons(self, topic: dict, concepts: list[Concept], max_lessons: int) -> LessonPlan:
        subtopics = "\n".join(f"- {st['id']}: {st['name']}" for st in topic["subtopics"])
        listing = "\n".join(f"- {c.name} ({c.source_id} p.{c.page}): {c.explanation}" for c in concepts)
        return self._parse(
            [{"type": "text", "text": self._prompt(
                "plan_lessons", topic_name=topic["name"], subtopics=subtopics,
                concepts=listing, max_lessons=str(max_lessons))}],
            LessonPlan, self._prompt("system"))

    def draft_lesson(self, plan: LessonPlanItem, concepts: list[Concept],
                     docs: list[SourceDocument]) -> LessonDraft:
        chosen = [c for c in concepts if c.name in plan.concept_names]
        cited = {c.source_id for c in chosen}
        listing = "\n".join(f"- {c.name} ({c.source_id} p.{c.page}): {c.explanation}"
                            f"{f' | quote: {c.quote}' if c.quote else ''}" for c in chosen)
        blocks = [self._document_block(d) for d in docs if d.id in cited]
        blocks.append({"type": "text", "text": self._prompt(
            "draft_lesson", title=plan.title, concepts=listing)})
        return self._parse(blocks, LessonDraft, self._prompt("system"))

    def verify_claims(self, claims: list[DraftClaim], docs: dict[str, SourceDocument]) -> list[bool]:
        if not claims:
            return []
        listing = "\n\n".join(
            f"Claim {i}: {c.text}\nSource {c.source_id} page {c.page}:\n"
            f"{docs[c.source_id].page_text(c.page) if c.source_id in docs else '<unknown source>'}"
            for i, c in enumerate(claims))
        result = self._parse([{"type": "text", "text": self._prompt("verify_claims", claims=listing)}],
                             ClaimVerdicts, self._prompt("system"))
        verdicts = {v.index: v.supported for v in result.verdicts}
        # A claim the verifier skipped counts as unsupported, never as verified.
        return [verdicts.get(i, False) for i in range(len(claims))]

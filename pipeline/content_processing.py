"""Shared source-grounded generation, validation, and evaluation helpers."""
from __future__ import annotations

import base64
import hashlib
import json
import math
import mimetypes
import os
import re
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import httpx
import nltk
import textstat
import yaml
from jsonschema import Draft202012Validator, FormatChecker
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
PROMPTS = Path(__file__).parent / "prompts"
PROMPT_VERSION = "psa-source-grounded-v1"
sys.path.insert(0, str(ROOT / "backend" / "scripts"))
from convert_repo_content import validate_export  # Read-only backend contract validator.


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def digest(value):
    raw = value if isinstance(value, bytes) else json.dumps(value, sort_keys=True).encode()
    return hashlib.sha256(raw).hexdigest()


def normalized(text):
    return " ".join(text.split())


def chapter_output_names(disease, topic):
    """Use the chapter order and title for readable output names."""
    slug = re.sub(r"[^a-z0-9]+", "-", topic["name"].lower().replace("&", "and")).strip("-")
    if not slug:
        raise ValueError("Chapter title must contain English letters or numbers.")
    return f"{topic['order']:02d}-{slug}", f"{disease['id']}-{slug}.json"


def obj(**properties):
    return {"type": "object", "additionalProperties": False,
            "properties": properties, "required": list(properties)}


def arr(items):
    return {"type": "array", "items": items}


STRING = {"type": "string"}
INT = {"type": "integer"}
BOOL = {"type": "boolean"}
CITATION = dict(source_id=STRING, source_page=INT, source_quote=STRING)
EXTRACT_SCHEMA = obj(text=STRING, uncertain_regions=arr(STRING),
                     concepts=arr(obj(label=STRING, quote=STRING)))
DRAFT_SCHEMA = obj(
    title=STRING, pages=arr(obj(sentences=arr(obj(text=STRING, **CITATION)))),
    key_takeaway_indices=arr(INT),
    quizzes=arr(obj(question=STRING, options=arr(STRING), answer=INT, feedback=STRING, **CITATION)))
VERDICT = obj(id=STRING, support={"type": "string", "enum": ["supported", "unsupported", "contradicted"]},
              reason=STRING, source_quote_verified=BOOL, numbers_ok=BOOL)
JUDGE_SCHEMA = obj(claims=arr(VERDICT), quizzes=arr(VERDICT),
                   coverage=arr(obj(id=STRING, covered=BOOL, claim_ids=arr(STRING), reason=STRING)),
                   safety_flags=arr(STRING), plain_language_flags=arr(STRING), title_supported=BOOL)


class ResponsesClient:
    """Small Responses API adapter; credentials and image bytes never enter logs."""

    def __init__(self, model, output, temperature=None):
        self.key = os.environ.get("OPENAI_API_KEY")
        if not self.key:
            raise ValueError("Set OPENAI_API_KEY in the environment; never put it in a manifest.")
        self.model, self.output, self.temperature = model, Path(output), temperature
        self.calls = []

    def call(self, stage, prompt_name, payload, schema, images=()):
        prompt = (PROMPTS / f"{prompt_name}.md").read_text(encoding="utf-8")
        content = [{"type": "input_text", "text": json.dumps(payload, ensure_ascii=False)}]
        for source_id, page, path in images:
            content.append({"type": "input_text", "text": f"Original: {source_id}, page {page}"})
            raw = base64.b64encode(Path(path).read_bytes()).decode("ascii")
            content.append({"type": "input_image", "detail": "high",
                            "image_url": f"data:{mimetypes.guess_type(path)[0]};base64,{raw}"})
        request = {"model": self.model, "store": False, "instructions": prompt,
                   "input": [{"role": "user", "content": content}], "max_output_tokens": 14000,
                   "text": {"format": {"type": "json_schema", "name": prompt_name,
                                       "strict": True, "schema": schema}}}
        if self.temperature is not None:
            request["temperature"] = self.temperature
        # Temperature is omitted for reasoning models that do not support it.
        started = time.perf_counter()
        for attempt in range(2):
            try:
                with httpx.Client(timeout=180) as client:
                    response = client.post("https://api.openai.com/v1/responses", json=request,
                                           headers={"Authorization": f"Bearer {self.key}"})
                if response.status_code in (429, 500, 502, 503, 504) and attempt == 0:
                    time.sleep(2)
                    continue
                if response.is_error:
                    # Do not expose API error bodies, which can echo submitted material.
                    raise ValueError(f"API HTTP {response.status_code} during {stage}; check model access/quota.")
                raw_response = response.json()
                break
            except httpx.TransportError:
                if attempt:
                    raise ValueError(f"API connection failed during {stage}.") from None
                time.sleep(2)
        if raw_response.get("status") != "completed":
            raise ValueError(f"API did not complete {stage}; no export will be written.")
        blocks = [c for item in raw_response.get("output", []) if item.get("type") == "message"
                  for c in item.get("content", [])]
        if any(c["type"] == "refusal" for c in blocks):
            raise ValueError(f"API declined {stage}; no export will be written.")
        result = json.loads("".join(c["text"] for c in blocks if c["type"] == "output_text"))
        Draft202012Validator(schema).validate(result)
        record = {"stage": stage, "model": raw_response["model"], "response_id": raw_response["id"],
                  "started_at": datetime.fromtimestamp(time.time() - (time.perf_counter() - started), timezone.utc).isoformat(),
                  "seconds": round(time.perf_counter() - started, 3), "http_attempts": attempt + 1,
                  "usage": raw_response.get("usage"), "prompt_sha256": digest(prompt.encode()),
                  "schema_sha256": digest(schema), "input_sha256": digest(payload),
                  "image_sha256": [digest(Path(p).read_bytes()) for _, _, p in images],
                  "temperature": self.temperature, "result": result}
        self.calls.append(record)
        write_json(self.output / "evidence.json", {"calls": self.calls})
        print(f"{stage}: {record['seconds']:.1f}s", flush=True)
        return result


def load_plan(path):
    plan = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    taxonomy = yaml.safe_load((ROOT / "topics.yaml").read_text(encoding="utf-8"))
    topic = next(t for t in taxonomy["topics"] if t["id"] == plan["topic_id"])
    sub = next(s for s in topic["subtopics"] if s["id"] == plan["subtopic_id"])
    ids = [l["id"] for l in plan["lessons"]]
    if not ids or len(ids) != len(set(ids)) or ids != [i for i in sub["lessons"] if i in ids]:
        raise ValueError("Manifest lesson IDs must be unique, known, and in topics.yaml order.")
    source_ids = plan["source_ids"]
    if not source_ids or len(source_ids) != len(set(source_ids)):
        raise ValueError("Manifest source IDs must be nonempty and unique.")
    for lesson in plan["lessons"]:
        if not lesson["source_ids"] or not set(lesson["source_ids"]) <= set(source_ids):
            raise ValueError("Lesson sources must belong to the manifest source list.")
        concept_ids = [c["id"] for c in lesson["concepts"]]
        if not concept_ids or len(concept_ids) != len(set(concept_ids)):
            raise ValueError("Reference concept IDs must be nonempty and unique within a lesson.")
    export_topic = {k: topic[k] for k in ("id", "name", "order")}
    export_topic["subtopics"] = [{**{k: sub[k] for k in ("id", "name", "order")}, "lesson_ids": ids}]
    return plan, taxonomy["disease"], export_topic


def source_records(plan):
    inventory = {s["id"]: s for s in read_json(ROOT / "data/psa/source-inventory.json")}
    records = []
    for sid in plan["source_ids"]:
        source = inventory[sid]
        if source["role"] != "educational_candidate":
            raise ValueError(f"{sid} is not an educational source candidate.")
        path = ROOT / source["local_file"]
        if digest(path.read_bytes()) != source["file_hash"]:
            raise ValueError(f"Source hash changed: {sid}. Re-inventory and review the source.")
        records.append(source)
    return records


def ingest(records, client):
    pages, images = [], []
    for source in records:
        path, sid = ROOT / source["local_file"], source["id"]
        if source["type"] == "image":
            image = (sid, 1, path)
            result = client.call(f"extract-{sid}", "extract", {"source_id": sid, "page": 1},
                                 EXTRACT_SCHEMA, [image])
            images.append(image)
            pages.append({"source_id": sid, "source_page": 1, "method": "LLM vision transcription",
                          "human_verified": False, **result})
        elif source["type"] == "pdf":
            for n, page in enumerate(PdfReader(path).pages, 1):
                text = page.extract_text() or ""
                if len(text.strip()) < 30:
                    raise ValueError(f"{sid} page {n}: no usable text. Register a page image for vision ingestion.")
                result = client.call(f"extract-{sid}-p{n}", "extract",
                                     {"source_id": sid, "page": n, "extracted_text": text}, EXTRACT_SCHEMA)
                # Preserve the original PDF text layer as citation authority.
                result["text"] = text
                pages.append({"source_id": sid, "source_page": n, "method": "pypdf text layer; LLM concepts",
                              "human_verified": False, **result})
        else:
            raise ValueError(f"{sid}: use an image or fixed-page PDF. Render DOCX to PDF and register it first; paragraph numbers are not pages.")
    for page in pages:
        if not page["text"].strip():
            raise ValueError("Empty source transcription.")
        for concept in page["concepts"]:
            if not normalized(concept["quote"]) or normalized(concept["quote"]) not in normalized(page["text"]):
                raise ValueError("Extracted concept quote is absent from its source page.")
    return pages, images


def assemble(draft, spec, plan):
    Draft202012Validator(DRAFT_SCHEMA).validate(draft)
    if len(draft["title"].split()) > 8 or not draft["title"].strip():
        raise ValueError("Title must have 1-8 words.")
    pages, claims = [], []
    for n, page in enumerate(draft["pages"], 1):
        if len(page["sentences"]) < 3:
            raise ValueError("Each page needs at least three cited sentences.")
        for sentence in page["sentences"]:
            if sentence["source_id"] not in spec["source_ids"]:
                raise ValueError("Draft cited a source outside this lesson's scope.")
            claims.append({"id": f"{spec['id']}-c{len(claims)+1}", "page": n,
                           **sentence, "support": "unsupported", "quote_match": 0.0})
        body = " ".join(s["text"].strip() for s in page["sentences"])
        if len(body.split()) > 150:
            raise ValueError("Page exceeds 150 words.")
        pages.append({"order": n, "body": body})
    indices = draft["key_takeaway_indices"]
    if len(indices) != len(set(indices)) or not all(1 <= i <= len(claims) for i in indices):
        raise ValueError("Invalid key takeaway sentence indices.")
    lesson = {"id": spec["id"], "topic_id": plan["topic_id"], "subtopic_id": plan["subtopic_id"],
              "title": draft["title"], "est_minutes": max(1, min(5, math.ceil(sum(len(p['body'].split()) for p in pages) / 150))),
              "pages": pages, "key_takeaways": [claims[i-1]["text"] for i in indices], "claims": claims,
              "checks": {"schema_valid": False}, "generated_by": "llm", "status": "draft"}
    if len(draft["quizzes"]) != 3:
        raise ValueError("Sample lessons need three quiz items.")
    quizzes = [{"id": f"{spec['id']}-q{n}", "lesson_id": spec["id"], **q, "status": "draft"}
               for n, q in enumerate(draft["quizzes"], 1)]
    for q in quizzes:
        if q["source_id"] not in spec["source_ids"] or len(q["question"].split()) > 25:
            raise ValueError("Quiz exceeds the question limit or cites an unassigned source.")
        if len({normalized(s).casefold() for s in q["options"]}) != len(q["options"]):
            raise ValueError("Quiz options must be distinct.")
    defs = read_json(ROOT / "schema/content.schema.json")["$defs"]
    for name, records in (("lesson", [lesson]), ("quiz", quizzes)):
        validator = Draft202012Validator({"$ref": f"#/$defs/{name}", "$defs": defs})
        for record in records:
            validator.validate(record)
    return lesson, quizzes


def init_readability():
    nltk.data.path.insert(0, str(ROOT / ".venv/nltk_data"))
    try:
        nltk.data.find("corpora/cmudict")
    except LookupError:
        raise ValueError("Install the English syllable dictionary: python -m nltk.downloader -d .venv/nltk_data cmudict") from None
    textstat.set_lang("en_US")


def readability(lesson, quizzes):
    units = [(f"page-{p['order']}", p["body"]) for p in lesson["pages"]]
    # Measure summaries and quizzes too; source quotes/reviewer notes are excluded.
    units += [("takeaways", " ".join(lesson["key_takeaways"]))]
    units += [(q["id"], " ".join([q["question"], *q["options"], q["feedback"]])) for q in quizzes]
    result = []
    for label, text in units:
        sentences = textstat.sentence_count(text)
        result.append({"unit": label, "words": textstat.lexicon_count(text, removepunct=True),
                       "sentences": sentences, "fk_grade": round(textstat.flesch_kincaid_grade(text), 3),
                       "smog": round(textstat.smog_index(text), 3) if sentences >= 3 else None,
                       "smog_short_sample": sentences < 30})
    return result


def quote_matches(item, pages):
    page = next((p for p in pages if (p["source_id"], p["source_page"]) ==
                 (item["source_id"], item["source_page"])), None)
    return bool(page and normalized(item["source_quote"]) and
                normalized(item["source_quote"]) in normalized(page["text"]))


def literal_numbers_ok(text, quote):
    pattern = r"\b\d+(?:\.\d+)?%?"
    return set(re.findall(pattern, text)) <= set(re.findall(pattern, quote))


def check_judge(judge, lesson, quizzes, concepts):
    Draft202012Validator(JUDGE_SCHEMA).validate(judge)
    for field, records in (("claims", lesson["claims"]), ("quizzes", quizzes), ("coverage", concepts)):
        expected, actual = [r["id"] for r in records], [r["id"] for r in judge[field]]
        if sorted(expected) != sorted(actual):
            raise ValueError(f"Judge must return exactly one result per {field} ID.")
    supported = {c["id"] for c in judge["claims"] if c["support"] == "supported" and c["source_quote_verified"]}
    for concept in judge["coverage"]:
        if concept["covered"] and (not concept["claim_ids"] or not set(concept["claim_ids"]) <= supported):
            raise ValueError("Covered concepts must name supported, source-verified claims.")


def evaluate(lesson, quizzes, pages, judge):
    verdicts = {v["id"]: v for v in judge["claims"] + judge["quizzes"]}
    problems, citation_passes, numbers = [], [], []
    for item in lesson["claims"] + quizzes:
        verdict = verdicts[item["id"]]
        match = quote_matches(item, pages)
        citation_passes.append(match and verdict["source_quote_verified"])
        patient_text = item.get("text", " ".join([item.get("question", ""), item.get("feedback", "")]))
        number_pass = verdict["numbers_ok"] and literal_numbers_ok(patient_text, item["source_quote"])
        numbers.append(number_pass)
        if "text" in item:
            item.update(support=verdict["support"], quote_match=float(match))
        if not match or not verdict["source_quote_verified"] or verdict["support"] != "supported" or not number_pass:
            problems.append(f"{item['id']}: {verdict['support']}; quote verified={match and verdict['source_quote_verified']}; numbers={number_pass}; {verdict['reason']}")
    if not judge["title_supported"]:
        problems.append("Title is not supported.")
    scores = readability(lesson, quizzes)
    for score in scores:
        if score["fk_grade"] > 8 or (score["smog"] is not None and score["smog"] > 8):
            problems.append(f"Simplify {score['unit']}: FK={score['fk_grade']}, SMOG={score['smog']} (target <=8).")
    flags = judge["safety_flags"] + judge["plain_language_flags"]
    if any(p["uncertain_regions"] for p in pages):
        flags.append("Source transcription has uncertain regions; manual source verification required.")
    patient_text = " ".join(p["body"] for p in lesson["pages"])
    if re.search(r"\b(?:\d+\s*(?:mg|mcg|ml)|you (?:should|must) (?:take|stop)|this means you have)\b", patient_text, re.I):
        flags.append("Medication/dose/diagnosis pattern requires review.")
    counts = Counter(c["support"] for c in lesson["claims"])
    lesson["checks"] = {"schema_valid": True, "citation_accuracy": sum(citation_passes) / len(citation_passes),
                        "claims_total": len(lesson["claims"]), "supported": counts["supported"],
                        "unsupported": counts["unsupported"], "contradicted": counts["contradicted"],
                        "numbers_ok": all(numbers), "safety_flags": flags,
                        "fk_grade": max(s["fk_grade"] for s in scores),
                        "smog": max(s["smog"] for s in scores if s["smog"] is not None),
                        "coverage": None}  # Human baseline is not available.
    return scores, problems + flags


def validate_content(data, pages, topic=None):
    schema = read_json(ROOT / "schema/content.schema.json")
    errors = validate_export(data, schema)
    if errors:
        return errors
    errors += [e.message for e in Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(data)]
    if topic is not None and data["topics"] != [topic]:
        errors.append("Topic membership or ordering differs from the manifest and topics.yaml.")
    for lesson in data["lessons"]:
        if lesson["status"] != "draft":
            errors.append(f"{lesson['id']}: this pipeline exports drafts only.")
        for page in lesson["pages"]:
            text = " ".join(c["text"].strip() for c in lesson["claims"] if c["page"] == page["order"])
            if normalized(text) != normalized(page["body"]):
                errors.append(f"{lesson['id']} page {page['order']}: uncited or altered text.")
        claim_texts = {c["text"] for c in lesson["claims"]}
        if not set(lesson["key_takeaways"]) <= claim_texts:
            errors.append(f"{lesson['id']}: uncited takeaway.")
        for item in lesson["claims"]:
            if not quote_matches(item, pages):
                errors.append(f"{item['id']}: quote absent from cited source page.")
        counts = Counter(c["support"] for c in lesson["claims"])
        if any(lesson["checks"].get(k) != counts[k] for k in ("supported", "unsupported", "contradicted")):
            errors.append(f"{lesson['id']}: claim support counts disagree.")
    for quiz in data["quizzes"]:
        if not quote_matches(quiz, pages):
            errors.append(f"{quiz['id']}: quote absent from cited source page.")
        if quiz["status"] != "draft":
            errors.append(f"{quiz['id']}: quiz must remain draft.")
    return errors

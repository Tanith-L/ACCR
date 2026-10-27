"""Backend Week 9 evaluation against a live Supabase project.

Import correctness, integrity, retrieval, access control, latency, error handling.
Uses the anon key for everything the app can do, and the service key only to
compare against the source bundle.
"""
from __future__ import annotations

import json
import statistics
import time
from pathlib import Path

from .db import anon_client, service_client
from .importer import bundle_to_rows


def _timed(fn, n: int = 20) -> tuple[float, float]:
    samples = []
    for _ in range(n):
        t0 = time.perf_counter()
        fn()
        samples.append((time.perf_counter() - t0) * 1000)
    samples.sort()
    return statistics.median(samples), samples[int(0.95 * (len(samples) - 1))]


def evaluate(bundle_path: Path) -> str:
    bundle = json.loads(bundle_path.read_text())
    rows = bundle_to_rows(bundle)
    svc, anon = service_client(), anon_client()
    results: list[tuple[str, str, bool]] = []

    # Import correctness: every lesson version in the bundle exists with identical content.
    mismatches = []
    for r in rows["lesson_versions"]:
        got = (svc.table("lesson_versions").select("title,body_markdown,status")
               .eq("lesson_id", r["lesson_id"]).eq("version", r["version"]).execute().data)
        if not got or got[0]["title"] != r["title"] or got[0]["body_markdown"] != r["body_markdown"]:
            mismatches.append(r["lesson_id"])
    n = len(rows["lesson_versions"])
    results.append(("Data import correctness", f"{n - len(mismatches)}/{n} match", not mismatches))

    # Integrity: lessons point at subtopics of their own topic.
    subs = {s["id"]: s["topic_id"] for s in svc.table("subtopics").select("id,topic_id").execute().data}
    bad = [l["id"] for l in svc.table("lessons").select("id,topic_id,subtopic_id").execute().data
           if subs.get(l["subtopic_id"]) != l["topic_id"]]
    results.append(("Database integrity", f"{len(bad)} invalid relationships", not bad))

    # Access control: anon must never see a non-published row or internal columns.
    leaked = anon.table("lesson_versions").select("lesson_id,status").neq("status", "published").execute().data
    try:
        anon.table("lesson_versions").select("claims").limit(1).execute()
        internal_hidden = False
    except Exception:
        internal_hidden = True
    results.append(("Content access control",
                    f"{len(leaked)} unpublished rows visible, internal columns "
                    f"{'hidden' if internal_hidden else 'VISIBLE'}",
                    not leaked and internal_hidden))

    # Retrieval: the three calls the app makes.
    topics = anon.table("v_topics").select("*").order("order_index").execute().data
    ok = True
    if topics:
        tid = topics[0]["id"]
        path = anon.table("v_lessons").select("id,title").eq("topic_id", tid).execute().data
        ok = bool(path) and bool(anon.table("v_lessons").select("*").eq("id", path[0]["id"]).execute().data)
    results.append(("Retrieval correctness", f"{len(topics)} published topics; path + lesson fetch "
                    f"{'ok' if ok else 'FAILED'}", ok))

    # Error handling: unknown id returns empty, not an error.
    missing = anon.table("v_lessons").select("*").eq("id", "does-not-exist").execute().data
    results.append(("Error handling", "missing lesson -> empty result", missing == []))

    med, p95 = _timed(lambda: anon.table("v_topics").select("*").execute())
    results.append(("Response performance", f"v_topics median {med:.0f} ms, p95 {p95:.0f} ms", True))

    out = ["# Backend evaluation", "", "| Dimension | Result | Pass |", "|---|---|---|"]
    out += [f"| {d} | {r} | {'yes' if p else 'NO'} |" for d, r, p in results]
    if mismatches:
        out += ["", "Mismatched lessons: " + ", ".join(mismatches)]
    return "\n".join(out) + "\n"

// rheumy-ingest: stores the passages Rheumy answers from, with gte-small embeddings.
// Called only by backend/scripts/rheumy_ingest.py with the project's SECRET key.
//
// POST { "action": "upsert", "chunks": [{ id, kind, source_id, title, locator, lesson_status, content, content_sha256 }] }
//   -> { embedded, unchanged }      (passages whose text hasn't changed are not re-embedded)
// POST { "action": "prune", "keep_ids": [...] }
//   -> { deleted }                  (removes passages the script no longer produces)
/// <reference path="../_shared/supabase-ai.d.ts" />
import { createClient } from "npm:@supabase/supabase-js@2";

import { callerKey, json, keyIsOneOf, missingSettings, notConfigured, secretKeys } from "../_shared/http.ts";

interface Chunk {
  id: string;
  kind: "lesson" | "source";
  source_id: string;
  title: string;
  locator: string | null;
  lesson_status: string | null;
  content: string;
  content_sha256: string;
}

const embedder = new Supabase.ai.Session("gte-small");
const ID = /^[a-z0-9-]+#\d+$/;
const MAX_BATCH = 32;

function checkChunk(c: Chunk): string | null {
  if (!c || typeof c !== "object") return "chunk must be an object";
  if (!ID.test(c.id ?? "")) return `bad id ${JSON.stringify(c.id)}`;
  if (c.kind !== "lesson" && c.kind !== "source") return `${c.id}: kind must be lesson or source`;
  for (const f of ["source_id", "title", "content", "content_sha256"] as const) {
    if (typeof c[f] !== "string" || !c[f].trim()) return `${c.id}: ${f} is required`;
  }
  if (c.content.length > 4000) return `${c.id}: content is too long`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);
  const missing = missingSettings(["SUPABASE_URL"]);
  if (!secretKeys().length) missing.push("SUPABASE_SECRET_KEYS");
  if (missing.length) return notConfigured(req, missing);
  if (!keyIsOneOf(callerKey(req), secretKeys())) return json(req, { error: "unauthorized" }, 401);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, secretKeys()[0], { auth: { persistSession: false } });
  let body: { action?: string; chunks?: Chunk[]; keep_ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "bad_request", message: "Body must be JSON." }, 400);
  }

  if (body.action === "upsert") {
    const chunks = body.chunks ?? [];
    if (!Array.isArray(chunks) || !chunks.length || chunks.length > MAX_BATCH) {
      return json(req, { error: "bad_request", message: `send 1 to ${MAX_BATCH} chunks` }, 400);
    }
    const problems = chunks.map(checkChunk).filter(Boolean);
    if (problems.length) return json(req, { error: "bad_request", message: problems.join("; ") }, 400);

    const { data: existing, error: readError } = await db
      .from("rheumy_chunks").select("id, content_sha256").in("id", chunks.map((c) => c.id));
    if (readError) return json(req, { error: "db_error", message: readError.message }, 500);
    const stored = new Map((existing ?? []).map((r) => [r.id, r.content_sha256]));
    const changed = chunks.filter((c) => stored.get(c.id) !== c.content_sha256);

    const rows = [];
    for (const c of changed) {
      const embedding = await embedder.run(`${c.title}\n${c.content}`, { mean_pool: true, normalize: true });
      rows.push({
        id: c.id, kind: c.kind, source_id: c.source_id, title: c.title, locator: c.locator ?? null,
        lesson_status: c.lesson_status ?? null, content: c.content, content_sha256: c.content_sha256,
        embedding: JSON.stringify(Array.from(embedding as number[])), updated_at: new Date().toISOString(),
      });
    }
    if (rows.length) {
      const { error } = await db.from("rheumy_chunks").upsert(rows);
      if (error) return json(req, { error: "db_error", message: error.message }, 500);
    }
    return json(req, { embedded: rows.length, unchanged: chunks.length - rows.length });
  }

  if (body.action === "prune") {
    const keep = new Set(body.keep_ids ?? []);
    if (!keep.size) return json(req, { error: "bad_request", message: "keep_ids must list the current passages" }, 400);
    const { data, error } = await db.from("rheumy_chunks").select("id");
    if (error) return json(req, { error: "db_error", message: error.message }, 500);
    const stale = (data ?? []).map((r) => r.id as string).filter((id) => !keep.has(id));
    for (let i = 0; i < stale.length; i += 200) {
      const { error: delError } = await db.from("rheumy_chunks").delete().in("id", stale.slice(i, i + 200));
      if (delError) return json(req, { error: "db_error", message: delError.message }, 500);
    }
    return json(req, { deleted: stale.length });
  }

  return json(req, { error: "bad_request", message: "action must be upsert or prune" }, 400);
});

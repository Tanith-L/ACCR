// rheumy-chat: answers a question about PsA from the RheumNotes lessons and sources.
//
// POST /functions/v1/rheumy-chat   headers: apikey: <publishable or anon key>
//   { "messages": [{ "role": "user", "content": "Why does my heel hurt?" }] }
// 200 { answer, citations[], urgency, reviewed: false, model }
//
// Flow: check key and origin -> scrub personal details -> emergency check (no model
// call) -> embed the question (gte-small, built in) -> hybrid search (rheumy_search)
// -> Groq chat completion -> answer with the passages it cites.
// Nothing is stored. Settings: GROQ_API_KEY (required), GROQ_MODEL, RHEUMY_ALLOWED_ORIGINS.
/// <reference path="../_shared/supabase-ai.d.ts" />
import { createClient } from "npm:@supabase/supabase-js@2";

import {
  callerKey,
  json,
  keyIsOneOf,
  missingSettings,
  notConfigured,
  originRejected,
  preflight,
  publishableKeys,
  rateLimiter,
  secretKeys,
} from "../_shared/http.ts";
import {
  buildModelMessages,
  citationsFor,
  EMERGENCY_REPLY,
  keywordQuery,
  normalizeCitations,
  parseChatBody,
  type Passage,
  scrubPersonal,
  URGENT_NOTICE,
  urgencyOf,
} from "../_shared/rheumy.ts";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = Deno.env.get("GROQ_MODEL")?.trim() || "openai/gpt-oss-120b";
const REQUIRED = ["GROQ_API_KEY", "SUPABASE_URL"];

const startupMissing = missingSettings(REQUIRED);
if (!secretKeys().length) startupMissing.push("SUPABASE_SECRET_KEYS");
if (startupMissing.length) console.error(`rheumy-chat: missing settings: ${startupMissing.join(", ")}`);

const embedder = new Supabase.ai.Session("gte-small");
const allow = rateLimiter(12);

async function search(question: string): Promise<Passage[]> {
  const embedding = await embedder.run(question, { mean_pool: true, normalize: true });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, secretKeys()[0], { auth: { persistSession: false } });
  const { data, error } = await db.rpc("rheumy_search", {
    query_embedding: JSON.stringify(Array.from(embedding as number[])),
    keywords: keywordQuery(question),
    match_count: 6,
  });
  if (error) throw new Error(`search failed: ${error.message}`);
  return (data ?? []) as Passage[];
}

async function complete(messages: unknown[]): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
      "Content-Type": "application/json",
      "User-Agent": "rheumnotes-rheumy/1.0", // Groq's Cloudflare front end refuses some default client names
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.2,
      max_completion_tokens: 700,
      ...(MODEL.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 429) throw Object.assign(new Error("busy"), { status: 429 });
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error("bad_llm_key"), { status: 502 });
  if (!res.ok) throw new Error(`Groq answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("Groq returned an empty answer");
  return text.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (originRejected(req)) return json(req, { error: "origin_not_allowed" }, 403);
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const missing = missingSettings(REQUIRED);
  if (!secretKeys().length) missing.push("SUPABASE_SECRET_KEYS");
  if (missing.length) return notConfigured(req, missing);
  if (!keyIsOneOf(callerKey(req), publishableKeys())) {
    return json(req, { error: "unauthorized", message: "Send the project's publishable (anon) key in the apikey header." }, 401);
  }
  if (!allow(req)) return json(req, { error: "rate_limited", message: "Too many questions at once. Please wait a minute." }, 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "bad_request", message: "Body must be JSON." }, 400);
  }
  const parsed = parseChatBody(body);
  if ("error" in parsed) return json(req, { error: "bad_request", message: parsed.error }, 400);

  const messages = parsed.messages.map((m) => ({ ...m, content: scrubPersonal(m.content) }));
  const question = messages[messages.length - 1].content;
  const urgency = urgencyOf(question);
  if (urgency === "emergency") {
    return json(req, { answer: EMERGENCY_REPLY, citations: [], urgency, reviewed: false, model: null });
  }

  try {
    const passages = await search(question);
    const answer = normalizeCitations(await complete(buildModelMessages(messages, passages)));
    return json(req, {
      answer,
      citations: citationsFor(answer, passages),
      urgency,
      notice: urgency === "urgent" ? URGENT_NOTICE : null,
      reviewed: false,
      model: MODEL,
    });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 429) {
      return json(req, { error: "busy", message: "Rheumy is busy right now. Please try again in a minute." }, 503);
    }
    if (status === 502) {
      console.error("rheumy-chat: Groq rejected GROQ_API_KEY");
      return json(req, { error: "llm_auth", message: "Rheumy's AI service key was rejected. Check GROQ_API_KEY." }, 502);
    }
    console.error("rheumy-chat:", e instanceof Error ? e.message : e);
    return json(req, { error: "server_error", message: "Rheumy couldn't answer just now. Please try again." }, 500);
  }
});

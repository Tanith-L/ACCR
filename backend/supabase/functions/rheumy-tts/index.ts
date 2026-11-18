// rheumy-tts: reads a Rheumy answer aloud with Azure AI Speech (official REST API).
//
// GET  /functions/v1/rheumy-tts?voice=ava&text=...&apikey=<publishable key>   (usable as an audio URL)
// POST /functions/v1/rheumy-tts  { "voice": "jenny", "text": "..." }  headers: apikey
// 200 audio/mpeg (24 kHz mono MP3)
//
// Voices: ava (en-US-AvaMultilingualNeural), jenny (en-US-JennyNeural), emma (en-US-EmmaNeural).
// The Azure key stays here: the function swaps it for a 10-minute token (reused for 9).
// Settings: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION (e.g. eastus), RHEUMY_ALLOWED_ORIGINS.
import {
  callerKey,
  corsHeaders,
  json,
  keyIsOneOf,
  missingSettings,
  notConfigured,
  originRejected,
  preflight,
  publishableKeys,
  rateLimiter,
} from "../_shared/http.ts";
import { MAX_SPEECH_CHARS, speechText, ssml, VOICES } from "../_shared/rheumy.ts";

const REQUIRED = ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"];
const startupMissing = missingSettings(REQUIRED);
if (startupMissing.length) console.error(`rheumy-tts: missing settings: ${startupMissing.join(", ")}`);

const allow = rateLimiter(20); // the F0 tier allows 20 requests per 60 seconds in total
let token: { value: string; until: number } | null = null;

function region(): string {
  return Deno.env.get("AZURE_SPEECH_REGION")!.trim().toLowerCase();
}

async function azureToken(): Promise<string> {
  if (token && Date.now() < token.until) return token.value;
  const res = await fetch(`https://${region()}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": Deno.env.get("AZURE_SPEECH_KEY")!.trim(), "Content-Length": "0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error("azure_auth"), { status: 502 });
  if (!res.ok) throw new Error(`Azure token request answered ${res.status}`);
  token = { value: await res.text(), until: Date.now() + 9 * 60_000 };
  return token.value;
}

async function synthesize(text: string, voice: string): Promise<ArrayBuffer> {
  const send = async () =>
    fetch(`https://${region()}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await azureToken()}`,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "rheumnotes-rheumy",
      },
      body: ssml(text, VOICES[voice]),
      signal: AbortSignal.timeout(30_000),
    });
  let res = await send();
  if (res.status === 401) { // token expired early: get a new one once
    token = null;
    res = await send();
  }
  if (res.status === 429) throw Object.assign(new Error("busy"), { status: 429 });
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error("azure_auth"), { status: 502 });
  if (!res.ok) throw new Error(`Azure Speech answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return await res.arrayBuffer();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (originRejected(req)) return json(req, { error: "origin_not_allowed" }, 403);
  if (req.method !== "GET" && req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const missing = missingSettings(REQUIRED);
  if (missing.length) return notConfigured(req, missing);
  if (!keyIsOneOf(callerKey(req), publishableKeys())) {
    return json(req, { error: "unauthorized", message: "Send the project's publishable (anon) key." }, 401);
  }
  if (!allow(req)) return json(req, { error: "rate_limited", message: "Too many requests. Please wait a minute." }, 429);

  let voice = "ava";
  let raw = "";
  if (req.method === "GET") {
    const q = new URL(req.url).searchParams;
    voice = q.get("voice") ?? voice;
    raw = q.get("text") ?? "";
  } else {
    try {
      const body = await req.json();
      voice = typeof body?.voice === "string" ? body.voice : voice;
      raw = typeof body?.text === "string" ? body.text : "";
    } catch {
      return json(req, { error: "bad_request", message: "Body must be JSON." }, 400);
    }
  }
  if (!(voice in VOICES)) return json(req, { error: "bad_request", message: `voice must be one of: ${Object.keys(VOICES).join(", ")}` }, 400);
  const text = speechText(raw);
  if (!text) return json(req, { error: "bad_request", message: "text is required" }, 400);
  if (text.length > MAX_SPEECH_CHARS) {
    return json(req, { error: "bad_request", message: `text must be under ${MAX_SPEECH_CHARS} characters` }, 400);
  }

  try {
    const audio = await synthesize(text, voice);
    return new Response(audio, {
      headers: { ...corsHeaders(req), "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 429) return json(req, { error: "busy", message: "The voice service is busy. Please try again in a minute." }, 503);
    if (status === 502) {
      console.error("rheumy-tts: Azure rejected AZURE_SPEECH_KEY or region");
      return json(req, { error: "tts_auth", message: "The voice service rejected the key. Check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION." }, 502);
    }
    console.error("rheumy-tts:", e instanceof Error ? e.message : e);
    return json(req, { error: "server_error", message: "Couldn't make the audio just now." }, 500);
  }
});

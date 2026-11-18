// HTTP helpers for the Rheumy Edge Functions: CORS, JSON replies, key checks and
// configuration checks. Secrets are read here and never returned to callers.

/**
 * Allowed browser origins, from the RHEUMY_ALLOWED_ORIGINS secret (comma-separated,
 * e.g. "https://rheumnotes.example.org,http://localhost:8081"). "*" or unset allows any.
 */
function allowedOrigin(req: Request): string | null {
  const setting = (Deno.env.get("RHEUMY_ALLOWED_ORIGINS") ?? "*").trim();
  if (setting === "*" || setting === "") return "*";
  const origin = req.headers.get("origin");
  if (!origin) return null; // not a browser request; CORS doesn't apply
  const list = setting.split(",").map((s) => s.trim().replace(/\/$/, ""));
  return list.includes(origin) ? origin : null;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = allowedOrigin(req);
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** True when the request comes from a browser origin that isn't allowed. */
export function originRejected(req: Request): boolean {
  return !!req.headers.get("origin") && allowedOrigin(req) === null;
}

export function json(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
}

export function preflight(req: Request): Response {
  return new Response(null, { status: originRejected(req) ? 403 : 204, headers: corsHeaders(req) });
}

function keysFrom(jsonVar: string, legacyVar: string): string[] {
  const keys: string[] = [];
  const raw = Deno.env.get(jsonVar);
  if (raw) {
    try {
      keys.push(...Object.values(JSON.parse(raw) as Record<string, string>).filter((k) => typeof k === "string"));
    } catch {
      console.error(`${jsonVar} is not valid JSON`);
    }
  }
  const legacy = Deno.env.get(legacyVar);
  if (legacy) keys.push(legacy);
  return keys;
}

/** The project's publishable keys (new sb_publishable_... and the legacy anon key). */
export const publishableKeys = () => keysFrom("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
/** The project's secret keys (new sb_secret_... and the legacy service_role key). */
export const secretKeys = () => keysFrom("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");

/** The key a caller sent: apikey header, Authorization: Bearer, or ?apikey= (audio URLs). */
export function callerKey(req: Request): string | null {
  const header = req.headers.get("apikey");
  if (header) return header.trim();
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return new URL(req.url).searchParams.get("apikey");
}

/** Constant-time comparison, so key checks don't leak timing. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function keyIsOneOf(key: string | null, allowed: string[]): boolean {
  return !!key && allowed.some((k) => same(key, k));
}

/** Names of required settings that are missing (names only, never values). */
export function missingSettings(names: string[]): string[] {
  return names.filter((n) => !Deno.env.get(n)?.trim());
}

/** The reply when the function isn't configured: names what's missing so it's easy to fix. */
export function notConfigured(req: Request, missing: string[]): Response {
  return json(req, {
    error: "not_configured",
    message: `Rheumy's server is missing settings: ${missing.join(", ")}. See docs/rheumy-chatbot.md.`,
    missing,
  }, 503);
}

/** Best-effort per-IP limit inside one function instance (the providers enforce the real quotas). */
export function rateLimiter(perMinute: number) {
  const hits = new Map<string, number[]>();
  return (req: Request): boolean => {
    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= perMinute) {
      hits.set(ip, recent);
      return false;
    }
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 5000) hits.clear();
    return true;
  };
}

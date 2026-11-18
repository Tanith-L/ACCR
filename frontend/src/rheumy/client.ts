// Rheumy chatbot client: talks to the rheumy-chat and rheumy-tts Supabase Edge
// Functions (backend/docs/api-contract.md §9). Only the public (anon/publishable) key
// is used here; the Groq and Azure keys live in the functions' secrets.
// Conversations exist only in memory on the device; nothing is saved.

export interface RheumyConfigOk {
  ok: true;
  functionsUrl: string;
  key: string;
}
export interface RheumyConfigMissing {
  ok: false;
  /** Names of the settings to add to frontend/.env.local (values are never shown). */
  missing: string[];
  problem?: string;
}
export type RheumyConfig = RheumyConfigOk | RheumyConfigMissing;

/**
 * Checks the two settings Rheumy needs. Pure, so it can be tested; the app passes
 * the EXPO_PUBLIC_* values (Expo inlines them only when read by their full name).
 */
export function readRheumyConfig(url: string | undefined, key: string | undefined): RheumyConfig {
  const missing: string[] = [];
  const cleanUrl = url?.trim().replace(/\/+$/, '') ?? '';
  const cleanKey = key?.trim() ?? '';
  if (!cleanUrl || cleanUrl.includes('YOUR-PROJECT')) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!cleanKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (missing.length) return { ok: false, missing };
  if (!/^https:\/\//.test(cleanUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanUrl)) {
    return { ok: false, missing: [], problem: 'EXPO_PUBLIC_SUPABASE_URL must start with https://' };
  }
  if (cleanKey.startsWith('sb_secret_')) {
    return { ok: false, missing: [], problem: 'EXPO_PUBLIC_SUPABASE_ANON_KEY is a secret key. Use the publishable (anon) key.' };
  }
  return { ok: true, functionsUrl: `${cleanUrl}/functions/v1`, key: cleanKey };
}

export const rheumyConfig: RheumyConfig = readRheumyConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface RheumyCitation {
  n: number;
  kind: 'lesson' | 'source';
  sourceId: string;
  title: string;
  locator: string | null;
}

export interface RheumyAnswer {
  answer: string;
  citations: RheumyCitation[];
  urgency: 'emergency' | 'urgent' | null;
  notice: string | null;
  reviewed: boolean;
}

export type RheumyErrorKind = 'network' | 'setup' | 'busy' | 'bad_request' | 'server';

export class RheumyError extends Error {
  constructor(public kind: RheumyErrorKind, message: string) {
    super(message);
  }
}

export const VOICES = [
  { id: 'ava', label: 'Ava' },
  { id: 'jenny', label: 'Jenny' },
  { id: 'emma', label: 'Emma' },
] as const;
export type VoiceId = (typeof VOICES)[number]['id'];

/** Keys in the new format (sb_publishable_...) aren't JWTs and go only in the apikey header. */
function authHeaders(key: string): Record<string, string> {
  return { apikey: key, ...(key.split('.').length === 3 ? { Authorization: `Bearer ${key}` } : {}) };
}

const TIMEOUT_MS = 45_000;

export async function askRheumy(
  turns: ChatTurn[],
  config: RheumyConfig = rheumyConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<RheumyAnswer> {
  if (!config.ok) throw new RheumyError('setup', 'Rheumy is not set up in this build.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchImpl(`${config.functionsUrl}/rheumy-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(config.key) },
      body: JSON.stringify({ messages: turns }),
      signal: controller.signal,
    });
  } catch {
    throw new RheumyError('network', 'Rheumy can’t be reached. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    // fall through with an empty body
  }
  const message = typeof body.message === 'string' ? body.message : undefined;
  if (res.ok && typeof body.answer === 'string') {
    return {
      answer: body.answer,
      citations: Array.isArray(body.citations) ? (body.citations as RheumyCitation[]) : [],
      urgency: (body.urgency as RheumyAnswer['urgency']) ?? null,
      notice: typeof body.notice === 'string' ? body.notice : null,
      reviewed: body.reviewed === true,
    };
  }
  if (res.status === 400) throw new RheumyError('bad_request', message ?? 'Rheumy couldn’t read that question.');
  if (res.status === 401 || res.status === 403 || body.error === 'not_configured' || body.error === 'llm_auth') {
    console.warn('Rheumy setup problem:', res.status, body.error, message);
    throw new RheumyError('setup', message ?? 'Rheumy is not set up correctly.');
  }
  if (res.status === 429 || body.error === 'busy') {
    throw new RheumyError('busy', message ?? 'Rheumy is busy right now. Please try again in a minute.');
  }
  throw new RheumyError('server', message ?? 'Rheumy couldn’t answer just now. Please try again.');
}

/** An audio URL for the answer read aloud (rheumy-tts). The key in it is the public one. */
export function speechUrl(text: string, voice: VoiceId, config: RheumyConfig = rheumyConfig): string | null {
  if (!config.ok) return null;
  const spoken = text.replace(/\[\d{1,2}\]/g, '').replace(/\s{2,}/g, ' ').trim().slice(0, 1500);
  const q = new URLSearchParams({ voice, text: spoken, apikey: config.key });
  return `${config.functionsUrl}/rheumy-tts?${q.toString()}`;
}

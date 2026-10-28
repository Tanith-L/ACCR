// Real Supabase/PostgREST requests with plain fetch and the anon key.
// RLS on the server guarantees only published content comes back.
import { ContentError } from './ContentService';
import type { Transport } from './api';

export interface HttpConfig {
  url: string;
  anonKey: string;
  timeoutMs?: number;
}

export function createHttpTransport({ url, anonKey, timeoutMs = 10000 }: HttpConfig): Transport {
  if (!url || !anonKey) {
    throw new ContentError('CONFIG', 'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing');
  }

  return async ({ method, path, query, body }) => {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${url}/rest/v1/${path}${qs}`, {
        method,
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: 'application/json',
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    } finally {
      clearTimeout(timer);
    }
  };
}

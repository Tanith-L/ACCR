// Picks the content source from EXPO_PUBLIC_CONTENT_SOURCE (see .env.example).
import { createApiService, type Transport } from './api';
import { ContentError, type ContentService } from './ContentService';
import { createHttpTransport } from './httpTransport';
import { createMockTransport, type MockFailure } from './mockTransport';
import { createPreviewTransport } from './previewTransport';

/**
 * mock: the backend's sample API responses. preview: the Data pipeline's real
 * exports, drafts included. supabase: the live API (published content only).
 */
export type ContentSource = 'mock' | 'preview' | 'supabase';

const SOURCES: ContentSource[] = ['mock', 'preview', 'supabase'];
const requested = process.env.EXPO_PUBLIC_CONTENT_SOURCE as ContentSource;
export const contentSource: ContentSource = SOURCES.includes(requested) ? requested : 'mock';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

function createTransport(): Transport {
  if (contentSource === 'supabase') {
    try {
      return createHttpTransport({ url: supabaseUrl, anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '' });
    } catch (e) {
      // Surface config problems through the normal error UI instead of crashing at startup.
      return async () => ({ status: 401, body: { message: String(e instanceof ContentError ? e.message : e) } });
    }
  }
  const fail = process.env.EXPO_PUBLIC_MOCK_FAIL;
  const options = {
    delayMs: Number(process.env.EXPO_PUBLIC_MOCK_DELAY_MS ?? 400),
    fail: fail === 'network' || fail === '400' || fail === '401' ? (fail as MockFailure) : undefined,
  };
  return contentSource === 'preview' ? createPreviewTransport(options) : createMockTransport(options);
}

export const contentService: ContentService = createApiService(createTransport());

export * from './ContentService';
export type * from './types';

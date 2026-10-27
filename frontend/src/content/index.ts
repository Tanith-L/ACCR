// Picks the content source from EXPO_PUBLIC_CONTENT_SOURCE (see .env.example).
import { ContentError, type ContentService } from './ContentService';
import { createMockService } from './mockService';
import { createSupabaseService } from './supabaseService';

export type ContentSource = 'mock' | 'supabase';

export const contentSource: ContentSource =
  process.env.EXPO_PUBLIC_CONTENT_SOURCE === 'supabase' ? 'supabase' : 'mock';

function create(): ContentService {
  if (contentSource === 'supabase') {
    try {
      return createSupabaseService({
        url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
        anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      });
    } catch (e) {
      // Surface config problems through the normal error UI instead of crashing at startup.
      const fail = () => Promise.reject(e instanceof ContentError ? e : new ContentError('CONFIG', String(e)));
      return { getTopics: fail, getLearningPath: fail, getLesson: fail };
    }
  }
  return createMockService({
    delayMs: Number(process.env.EXPO_PUBLIC_MOCK_DELAY_MS ?? 400),
    fail: process.env.EXPO_PUBLIC_MOCK_FAIL === '1',
  });
}

export const contentService: ContentService = create();

/** Base URL for lesson images in Supabase mode (public Storage bucket). */
export const mediaBaseUrl = process.env.EXPO_PUBLIC_MEDIA_BASE_URL ?? '';

export * from './ContentService';
export type * from './types';

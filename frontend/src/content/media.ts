// Lesson images. In Supabase mode they load from the public `media` bucket
// (api-contract.md §3.5). In mock mode they are bundled from backend/fixtures;
// Metro needs static require() calls, so add a line when a fixture image is added.
import type { ImageSourcePropType } from 'react-native';

import { contentSource, supabaseUrl } from './index';

const MOCK_MEDIA: Record<string, ImageSourcePropType> = {
  'mock-joints.png': require('../../../backend/fixtures/mock-joints.png'),
};

export function storageUrl(baseUrl: string, path: string): string {
  return `${baseUrl}/storage/v1/object/public/media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** Returns null when the image can't be resolved; callers show a placeholder. */
export function resolveImage(path: string): ImageSourcePropType | null {
  if (contentSource === 'mock') return MOCK_MEDIA[path] ?? null;
  return supabaseUrl ? { uri: storageUrl(supabaseUrl, path) } : null;
}

// Lesson images. In Supabase mode they load from the public `media` bucket
// (api-contract.md §3.5). In mock and preview mode they are bundled from
// backend/fixtures and the pipeline's data/psa/chapter/media, keyed by the path
// the API would return. Metro needs static require() calls, so add a line when
// an image is added.
import type { ImageSourcePropType } from 'react-native';

import { contentSource, supabaseUrl } from './index';

export const LOCAL_MEDIA: Record<string, ImageSourcePropType> = {
  'mock-joints.png': require('../../../backend/fixtures/mock-joints.png'),
  'psa-overview-grappa-domains.jpg': require('../../../data/psa/chapter/media/overview-grappa-domains.jpg'),
  'psa-symptoms-body-map.jpg': require('../../../data/psa/chapter/media/symptoms-body-map.jpg'),
  'psa-skin-psoriasis.jpg': require('../../../data/psa/chapter/media/skin-psoriasis.jpg'),
  'psa-nail-psoriasis.jpg': require('../../../data/psa/chapter/media/nail-psoriasis.jpg'),
  'psa-achilles-enthesitis.jpg': require('../../../data/psa/chapter/media/achilles-enthesitis.jpg'),
  'psa-plantar-fasciitis.jpg': require('../../../data/psa/chapter/media/plantar-fasciitis.jpg'),
};

export function storageUrl(baseUrl: string, path: string): string {
  return `${baseUrl}/storage/v1/object/public/media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** Returns null when the image can't be resolved; callers show a placeholder. */
export function resolveImage(path: string): ImageSourcePropType | null {
  if (contentSource !== 'supabase') return LOCAL_MEDIA[path] ?? null;
  return supabaseUrl ? { uri: storageUrl(supabaseUrl, path) } : null;
}

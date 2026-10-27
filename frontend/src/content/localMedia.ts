// Lesson images for mock mode, bundled from /media. Metro needs static
// require() calls, so add a line here when a file is added to media/media.yaml.
// In Supabase mode images load from EXPO_PUBLIC_MEDIA_BASE_URL instead.
import type { ImageSourcePropType } from 'react-native';

import { contentSource, mediaBaseUrl } from './index';

const LOCAL_MEDIA: Record<string, ImageSourcePropType> = {
  'psa-body-areas.jpg': require('../../../media/psa-body-areas.jpg'),
  'psa-clinical-manifestations.jpg': require('../../../media/psa-clinical-manifestations.jpg'),
  'psa-comorbidities.jpg': require('../../../media/psa-comorbidities.jpg'),
  'psa-grappa-domains.jpg': require('../../../media/psa-grappa-domains.jpg'),
  'psa-one-pager.jpg': require('../../../media/psa-one-pager.jpg'),
};

/** Returns null when the image can't be resolved; callers show a placeholder. */
export function resolveImage(file: string): ImageSourcePropType | null {
  if (contentSource === 'mock') return LOCAL_MEDIA[file] ?? null;
  return mediaBaseUrl ? { uri: `${mediaBaseUrl}/${encodeURIComponent(file)}` } : null;
}

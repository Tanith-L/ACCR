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
  'psa-dactylitis.jpg': require('../../../data/psa/chapter/media/dactylitis-toe-finger.jpg'),
  'psa-nail-changes.jpg': require('../../../data/psa/chapter/media/nail-pitting-onycholysis.jpg'),
  'psa-spine-xray.jpg': require('../../../data/psa/chapter/media/spine-xray-spondylitis.jpg'),
};

export function storageUrl(baseUrl: string, path: string): string {
  return `${baseUrl}/storage/v1/object/public/media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** Returns null when the image can't be resolved; callers show a placeholder. */
export function resolveImage(path: string): ImageSourcePropType | null {
  if (contentSource !== 'supabase') return LOCAL_MEDIA[path] ?? null;
  return supabaseUrl ? { uri: storageUrl(supabaseUrl, path) } : null;
}

/**
 * Lesson videos (whiteboard animation with narration and embedded captions),
 * made by pipeline/lesson_video and saved next to each chapter's lessons.
 * Each has a cover (`<id>-cover.jpg`, a frame of its title scene). They aren't in the API yet, so only mock and preview mode bundle them;
 * `minutes` is rounded from the video's length.
 */
export interface LessonVideoAsset {
  source: number;
  /** The title frame, shown until the patient presses play. */
  cover: ImageSourcePropType;
  minutes: number;
}

export const LOCAL_VIDEOS: Record<string, LessonVideoAsset> = {
  'psa-dx-01': {
    source: require('../../../data/psa/chapter/01-understanding-diagnosis/videos/psa-dx-01.mp4'),
    cover: require('../../../data/psa/chapter/01-understanding-diagnosis/videos/psa-dx-01-cover.jpg'),
    minutes: 3,
  },
  'psa-dx-02': {
    source: require('../../../data/psa/chapter/01-understanding-diagnosis/videos/psa-dx-02.mp4'),
    cover: require('../../../data/psa/chapter/01-understanding-diagnosis/videos/psa-dx-02-cover.jpg'),
    minutes: 2,
  },
  'psa-overview-01': {
    source: require('../../../data/psa/chapter/02-understanding-psoriatic-arthritis/videos/psa-overview-01.mp4'),
    cover: require('../../../data/psa/chapter/02-understanding-psoriatic-arthritis/videos/psa-overview-01-cover.jpg'),
    minutes: 2,
  },
  'psa-overview-02': {
    source: require('../../../data/psa/chapter/02-understanding-psoriatic-arthritis/videos/psa-overview-02.mp4'),
    cover: require('../../../data/psa/chapter/02-understanding-psoriatic-arthritis/videos/psa-overview-02-cover.jpg'),
    minutes: 2,
  },
  'psa-symptoms-01': {
    source: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-01.mp4'),
    cover: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-01-cover.jpg'),
    minutes: 1,
  },
  'psa-symptoms-02': {
    source: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-02.mp4'),
    cover: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-02-cover.jpg'),
    minutes: 2,
  },
  'psa-symptoms-03': {
    source: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-03.mp4'),
    cover: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-03-cover.jpg'),
    minutes: 2,
  },
  'psa-symptoms-04': {
    source: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-04.mp4'),
    cover: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-04-cover.jpg'),
    minutes: 1,
  },
  'psa-symptoms-05': {
    source: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-05.mp4'),
    cover: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-05-cover.jpg'),
    minutes: 1,
  },
  'psa-symptoms-06': {
    source: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-06.mp4'),
    cover: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-06-cover.jpg'),
    minutes: 1,
  },
  'psa-symptoms-07': {
    source: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-07.mp4'),
    cover: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-07-cover.jpg'),
    minutes: 1,
  },
  'psa-symptoms-08': {
    source: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-08.mp4'),
    cover: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-08-cover.jpg'),
    minutes: 1,
  },
  'psa-symptoms-09': {
    source: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-09.mp4'),
    cover: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-09-cover.jpg'),
    minutes: 1,
  },
  'psa-symptoms-10': {
    source: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-10.mp4'),
    cover: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-10-cover.jpg'),
    minutes: 1,
  },
  'psa-symptoms-11': {
    source: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-11.mp4'),
    cover: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-11-cover.jpg'),
    minutes: 1,
  },
  'psa-symptoms-12': {
    source: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-12.mp4'),
    cover: require('../../../data/psa/chapter/03-symptoms-and-disease-progression/videos/psa-symptoms-12-cover.jpg'),
    minutes: 1,
  },
  'psa-treatment-01': {
    source: require('../../../data/psa/chapter/04-treatment-options-and-flare-management/videos/psa-treatment-01.mp4'),
    cover: require('../../../data/psa/chapter/04-treatment-options-and-flare-management/videos/psa-treatment-01-cover.jpg'),
    minutes: 2,
  },
  'psa-treatment-02': {
    source: require('../../../data/psa/chapter/04-treatment-options-and-flare-management/videos/psa-treatment-02.mp4'),
    cover: require('../../../data/psa/chapter/04-treatment-options-and-flare-management/videos/psa-treatment-02-cover.jpg'),
    minutes: 2,
  },
  'psa-treatment-03': {
    source: require('../../../data/psa/chapter/04-treatment-options-and-flare-management/videos/psa-treatment-03.mp4'),
    cover: require('../../../data/psa/chapter/04-treatment-options-and-flare-management/videos/psa-treatment-03-cover.jpg'),
    minutes: 2,
  },
  'psa-education-01': {
    source: require('../../../data/psa/chapter/05-patient-education/videos/psa-education-01.mp4'),
    cover: require('../../../data/psa/chapter/05-patient-education/videos/psa-education-01-cover.jpg'),
    minutes: 2,
  },
  'psa-education-02': {
    source: require('../../../data/psa/chapter/05-patient-education/videos/psa-education-02.mp4'),
    cover: require('../../../data/psa/chapter/05-patient-education/videos/psa-education-02-cover.jpg'),
    minutes: 2,
  },
  'psa-education-03': {
    source: require('../../../data/psa/chapter/05-patient-education/videos/psa-education-03.mp4'),
    cover: require('../../../data/psa/chapter/05-patient-education/videos/psa-education-03-cover.jpg'),
    minutes: 2,
  },
  'psa-contact-01': {
    source: require('../../../data/psa/chapter/06-when-to-contact-the-care-team/videos/psa-contact-01.mp4'),
    cover: require('../../../data/psa/chapter/06-when-to-contact-the-care-team/videos/psa-contact-01-cover.jpg'),
    minutes: 1,
  },
  'psa-contact-02': {
    source: require('../../../data/psa/chapter/06-when-to-contact-the-care-team/videos/psa-contact-02.mp4'),
    cover: require('../../../data/psa/chapter/06-when-to-contact-the-care-team/videos/psa-contact-02-cover.jpg'),
    minutes: 1,
  },
};

/** The lesson's video, or null when there is none (always null in Supabase mode for now). */
export function resolveVideo(lessonId: string): LessonVideoAsset | null {
  if (contentSource === 'supabase') return null;
  return LOCAL_VIDEOS[lessonId] ?? null;
}

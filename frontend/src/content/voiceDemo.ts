// Narration voice candidates, for showing the client how each voice sounds in a real lesson.
// Ava is the voice of every lesson video. The others are samples of a few lessons, made with
// pipeline/lesson_video/build_videos.py --voice <id> --demo-dir frontend/assets/voice-demo.
// Shown only in mock and preview mode (team and client review), never with the live API.
// Metro needs static require() calls: add a line when a sample is rendered.
import { contentSource } from './index';

export interface VoiceCandidate {
  id: string;
  label: string;
  /** One line for the client: what the voice sounds like and where it comes from. */
  description: string;
}

export const VOICE_CANDIDATES: VoiceCandidate[] = [
  { id: 'ava', label: 'Ava', description: 'Warm and caring (Microsoft neural voice). Current voice.' },
  { id: 'jenny', label: 'Jenny', description: 'Friendly and reassuring (Microsoft neural voice).' },
  { id: 'emma', label: 'Emma', description: 'Bright, clear and conversational (Microsoft neural voice).' },
  { id: 'heart', label: 'Heart', description: 'Soft and natural (Kokoro, open source, made on our computer).' },
  { id: 'bella', label: 'Bella', description: 'Expressive and lively (Kokoro, open source, made on our computer).' },
];

/** Sample videos by voice, then lesson. */
const SAMPLES: Record<string, Record<string, number>> = {
  jenny: {
    'psa-overview-01': require('../../assets/voice-demo/jenny/psa-overview-01.mp4'),
    'psa-symptoms-02': require('../../assets/voice-demo/jenny/psa-symptoms-02.mp4'),
  },
  emma: {
    'psa-overview-01': require('../../assets/voice-demo/emma/psa-overview-01.mp4'),
    'psa-symptoms-02': require('../../assets/voice-demo/emma/psa-symptoms-02.mp4'),
  },
  heart: {
    'psa-overview-01': require('../../assets/voice-demo/heart/psa-overview-01.mp4'),
    'psa-symptoms-02': require('../../assets/voice-demo/heart/psa-symptoms-02.mp4'),
  },
  bella: {
    'psa-overview-01': require('../../assets/voice-demo/bella/psa-overview-01.mp4'),
    'psa-symptoms-02': require('../../assets/voice-demo/bella/psa-symptoms-02.mp4'),
  },
};

export interface VoiceVersion {
  voice: VoiceCandidate;
  source: number;
}

/**
 * The lesson's video in each candidate voice, Ava (the lesson's own video) first.
 * Empty when the lesson has no samples, so the player shows no voice switch.
 */
export function voiceVersions(lessonId: string, avaSource: number): VoiceVersion[] {
  if (contentSource === 'supabase') return [];
  const versions = VOICE_CANDIDATES.flatMap((voice) => {
    const source = voice.id === 'ava' ? avaSource : SAMPLES[voice.id]?.[lessonId];
    return source ? [{ voice, source }] : [];
  });
  return versions.length > 1 ? versions : [];
}

// Answers API requests from backend/fixtures/mock_responses, the backend's
// sample responses for the contract, so the app runs with no backend.
// Metro needs static imports: add a line to RESPONSES when the backend adds a fixture.
import error400 from '../../../backend/fixtures/mock_responses/error_400.json';
import error401 from '../../../backend/fixtures/mock_responses/error_401.json';
import learningPathDx from '../../../backend/fixtures/mock_responses/learning_path_dx.json';
import lessonDx01 from '../../../backend/fixtures/mock_responses/lesson_psa-dx-01.json';
import lessonDx02 from '../../../backend/fixtures/mock_responses/lesson_psa-dx-02.json';
import quizDx01 from '../../../backend/fixtures/mock_responses/quiz_psa-dx-01.json';
import quizDx02 from '../../../backend/fixtures/mock_responses/quiz_psa-dx-02.json';
import topics from '../../../backend/fixtures/mock_responses/topics.json';

import type { ApiRequest, Transport } from './api';

const RESPONSES: Record<string, unknown> = {
  'topics.json': topics,
  'learning_path_dx.json': learningPathDx,
  'lesson_psa-dx-01.json': lessonDx01,
  'lesson_psa-dx-02.json': lessonDx02,
  'quiz_psa-dx-01.json': quizDx01,
  'quiz_psa-dx-02.json': quizDx02,
};

/** Which error to simulate on every request (EXPO_PUBLIC_MOCK_FAIL). */
export type MockFailure = 'network' | '400' | '401';

export interface MockOptions {
  delayMs?: number;
  fail?: MockFailure;
}

const eqValue = (request: ApiRequest, key: string) => request.query?.[key]?.replace(/^eq\./, '');

/** Fixture name for a request, or null for one the contract doesn't allow. */
function fixtureFor(request: ApiRequest): string | null {
  switch (request.path) {
    case 'v_topics':
      return 'topics.json';
    case 'rpc/get_learning_path':
      return `learning_path_${(request.body as { p_topic_id?: string } | undefined)?.p_topic_id}.json`;
    case 'v_lessons':
      return `lesson_${eqValue(request, 'id')}.json`;
    case 'v_quiz_items':
      return `quiz_${eqValue(request, 'lesson_id')}.json`;
    default:
      return null;
  }
}

export function createMockTransport({ delayMs = 0, fail }: MockOptions = {}): Transport {
  return async (request) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    if (fail === 'network') throw new TypeError('Mock network failure (EXPO_PUBLIC_MOCK_FAIL=network)');
    if (fail === '401') return { status: 401, body: error401 };
    const name = fixtureFor(request);
    if (fail === '400' || !name) return { status: 400, body: error400 };
    // Unknown or unpublished ids answer 200 with [] (empty.json), like the real API.
    return { status: 200, body: RESPONSES[name] ?? [] };
  };
}

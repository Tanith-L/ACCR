// ContentService over the REST API in backend/docs/api-contract.md.
// The transport is either real HTTP (httpTransport.ts) or the backend's
// sample responses (mockTransport.ts); status handling is the same for both.
import { ContentError, type ContentService } from './ContentService';
import {
  toLearningPath,
  toLesson,
  toQuiz,
  toTopics,
  type LessonRow,
  type PathSubtopicRow,
  type QuizRow,
  type TopicRow,
} from './mappers';

export interface ApiRequest {
  method: 'GET' | 'POST';
  /** Relative to /rest/v1, e.g. `v_topics` or `rpc/get_learning_path`. */
  path: string;
  query?: Record<string, string>;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

/** Resolves with any HTTP response; rejects only when there is no response (offline, timeout). */
export type Transport = (request: ApiRequest) => Promise<ApiResponse>;

function errorFor(status: number, path: string): ContentError {
  const message = `${path} returned ${status}`;
  if (status === 400) return new ContentError('BAD_REQUEST', message);
  if (status === 401 || status === 403) return new ContentError('CONFIG', message);
  if (status >= 500) return new ContentError('NETWORK', message);
  return new ContentError('UNKNOWN', message);
}

export function createApiService(transport: Transport): ContentService {
  async function call<T>(request: ApiRequest): Promise<T[]> {
    let response: ApiResponse;
    try {
      response = await transport(request);
    } catch {
      // Contract §4: retry a network failure once, then show the error state.
      try {
        response = await transport(request);
      } catch (e) {
        throw new ContentError('NETWORK', `Request to ${request.path} failed`, e);
      }
    }
    if (response.status < 200 || response.status >= 300) throw errorFor(response.status, request.path);
    if (!Array.isArray(response.body)) {
      throw new ContentError('UNKNOWN', `${request.path} did not return an array`);
    }
    return response.body as T[];
  }

  return {
    async getTopics() {
      const rows = await call<TopicRow>({
        method: 'GET',
        path: 'v_topics',
        query: { select: 'id,name,icon,sort_order', order: 'sort_order' },
      });
      return toTopics(rows);
    },

    async getLearningPath(topicId) {
      const rows = await call<PathSubtopicRow>({
        method: 'POST',
        path: 'rpc/get_learning_path',
        body: { p_topic_id: topicId },
      });
      return toLearningPath(rows);
    },

    async getLesson(lessonId) {
      const rows = await call<LessonRow>({ method: 'GET', path: 'v_lessons', query: { id: `eq.${lessonId}` } });
      return rows[0] ? toLesson(rows[0]) : null;
    },

    async getQuiz(lessonId) {
      const rows = await call<QuizRow>({
        method: 'GET',
        path: 'v_quiz_items',
        query: { lesson_id: `eq.${lessonId}`, order: 'id' },
      });
      return toQuiz(rows);
    },
  };
}

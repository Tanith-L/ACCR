// ContentService backed by the Supabase views (v_topics, v_subtopics, v_lessons).
// Talks to PostgREST with plain fetch and the anon key; RLS on the server
// guarantees only published content comes back. See docs/api-contract.md.
import { ContentError, type ContentService } from './ContentService';
import {
  buildLearningPath,
  toLesson,
  toTopic,
  type LessonRow,
  type LessonSummaryRow,
  type SubtopicRow,
  type TopicRow,
} from './mappers';

const SUMMARY_COLUMNS = 'id,topic_id,subtopic_id,order_index,title,summary,est_minutes';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  timeoutMs?: number;
}

export function createSupabaseService({ url, anonKey, timeoutMs = 10000 }: SupabaseConfig): ContentService {
  if (!url || !anonKey) {
    throw new ContentError('CONFIG', 'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing');
  }

  async function get<T>(view: string, query: Record<string, string>): Promise<T[]> {
    const qs = new URLSearchParams(query).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${url}/rest/v1/${view}?${qs}`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (e) {
      throw new ContentError('NETWORK', `Request to ${view} failed`, e);
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const code = res.status === 401 || res.status === 403 ? 'CONFIG' : res.status >= 500 ? 'NETWORK' : 'UNKNOWN';
      throw new ContentError(code, `${view} returned ${res.status}: ${body}`);
    }
    return (await res.json()) as T[];
  }

  return {
    async getTopics() {
      const rows = await get<TopicRow>('v_topics', { select: '*', order: 'order_index.asc' });
      return rows.map(toTopic);
    },

    async getLearningPath(topicId) {
      const eq = `eq.${topicId}`;
      const [topics, subtopics, lessons] = await Promise.all([
        get<TopicRow>('v_topics', { select: '*', id: eq }),
        get<SubtopicRow>('v_subtopics', { select: 'id,topic_id,name,order_index', topic_id: eq }),
        get<LessonSummaryRow>('v_lessons', { select: SUMMARY_COLUMNS, topic_id: eq }),
      ]);
      if (!topics[0]) throw new ContentError('NOT_FOUND', `No published topic ${topicId}`);
      return buildLearningPath(toTopic(topics[0]), subtopics, lessons);
    },

    async getLesson(lessonId) {
      const rows = await get<LessonRow>('v_lessons', { select: '*', id: `eq.${lessonId}` });
      if (!rows[0]) throw new ContentError('NOT_FOUND', `No published lesson ${lessonId}`);
      return toLesson(rows[0]);
    },
  };
}

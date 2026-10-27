// Mock ContentService backed by the Data pipeline's bundle JSON.
// It builds the exact rows the Supabase views would return and runs them
// through the same mappers, so screens can't tell the difference.
// Unlike Supabase it includes unpublished lessons: this is the review/demo environment.
import bundle from '../../../data/output/psa_legacy.json';

import { ContentError, type ContentService } from './ContentService';
import {
  buildLearningPath,
  toLesson,
  toTopic,
  type LessonRow,
  type SubtopicRow,
  type TopicRow,
} from './mappers';
import type { ContentStatus } from './types';

// Only the bundle fields the mock reads; full shape in shared/schema/content-bundle.schema.json.
interface Bundle {
  disease: { id: string };
  sources: { id: string; title: string; url: string | null }[];
  topics: {
    id: string;
    name: string;
    order: number;
    icon: string | null;
    description: string | null;
    subtopics: { id: string; name: string; order: number }[];
  }[];
  lessons: {
    id: string;
    version: number;
    topic_id: string;
    subtopic_id: string;
    order: number;
    title: string;
    summary: string;
    est_minutes: number;
    body_markdown: string;
    key_takeaways: string[];
    images: { file: string; alt_text: string; credit: string | null }[];
    source_refs: { source_id: string; pages: number[] }[];
    status: ContentStatus;
    quiz: LessonRow['quiz'];
  }[];
}

export interface MockOptions {
  bundle?: Bundle;
  delayMs?: number;
  fail?: boolean;
}

export function createMockService(options: MockOptions = {}): ContentService {
  const data = (options.bundle ?? bundle) as Bundle;
  const delayMs = options.delayMs ?? 0;
  const sources = new Map(data.sources.map((s) => [s.id, s]));

  const lessonRows: LessonRow[] = data.lessons.map((l) => ({
    id: l.id,
    topic_id: l.topic_id,
    subtopic_id: l.subtopic_id,
    order_index: l.order,
    version: l.version,
    title: l.title,
    summary: l.summary,
    est_minutes: l.est_minutes,
    status: l.status,
    body_markdown: l.body_markdown,
    key_takeaways: l.key_takeaways,
    images: l.images,
    references: l.source_refs.map((r) => ({
      source_id: r.source_id,
      title: sources.get(r.source_id)?.title ?? null,
      url: sources.get(r.source_id)?.url ?? null,
      pages: r.pages,
    })),
    quiz: l.quiz,
  }));

  const topicRows: TopicRow[] = data.topics
    .map((t) => {
      const lessons = lessonRows.filter((l) => l.topic_id === t.id);
      return {
        id: t.id,
        disease_id: data.disease.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        order_index: t.order,
        lesson_count: lessons.length,
        total_minutes: lessons.reduce((sum, l) => sum + l.est_minutes, 0),
      };
    })
    .filter((t) => t.lesson_count > 0);

  const subtopicRows: SubtopicRow[] = data.topics.flatMap((t) =>
    t.subtopics.map((s) => ({ id: s.id, topic_id: t.id, name: s.name, order_index: s.order })),
  );

  async function respond<T>(make: () => T): Promise<T> {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    if (options.fail) throw new ContentError('NETWORK', 'Mock failure (EXPO_PUBLIC_MOCK_FAIL=1)');
    return make();
  }

  return {
    getTopics: () =>
      respond(() => [...topicRows].sort((a, b) => a.order_index - b.order_index).map(toTopic)),

    getLearningPath: (topicId) =>
      respond(() => {
        const topic = topicRows.find((t) => t.id === topicId);
        if (!topic) throw new ContentError('NOT_FOUND', `No topic ${topicId}`);
        return buildLearningPath(
          toTopic(topic),
          subtopicRows.filter((s) => s.topic_id === topicId),
          lessonRows.filter((l) => l.topic_id === topicId),
        );
      }),

    getLesson: (lessonId) =>
      respond(() => {
        const row = lessonRows.find((l) => l.id === lessonId);
        if (!row) throw new ContentError('NOT_FOUND', `No lesson ${lessonId}`);
        return toLesson(row);
      }),
  };
}

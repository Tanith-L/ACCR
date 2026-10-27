// snake_case rows from the Supabase views (docs/api-contract.md) -> app types.
import type {
  ContentStatus,
  LearningPath,
  Lesson,
  LessonSummary,
  SubtopicPath,
  TopicSummary,
} from './types';

export interface TopicRow {
  id: string;
  disease_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  order_index: number;
  lesson_count: number;
  total_minutes: number;
}

export interface SubtopicRow {
  id: string;
  topic_id: string;
  name: string;
  order_index: number;
}

export interface LessonSummaryRow {
  id: string;
  topic_id: string;
  subtopic_id: string;
  order_index: number;
  title: string;
  summary: string;
  est_minutes: number;
  status?: ContentStatus;
}

export interface LessonRow extends LessonSummaryRow {
  version: number;
  body_markdown: string;
  key_takeaways: string[];
  images: { file: string; alt_text: string; credit?: string | null }[];
  references: { source_id: string; title: string | null; url: string | null; pages: number[] }[];
  quiz: { id: string; question: string; options: string[]; answer: number; feedback?: string | null }[];
}

export const toTopic = (r: TopicRow): TopicSummary => ({
  id: r.id,
  diseaseId: r.disease_id,
  name: r.name,
  description: r.description,
  icon: r.icon,
  order: r.order_index,
  lessonCount: r.lesson_count,
  totalMinutes: r.total_minutes,
});

export const toLessonSummary = (r: LessonSummaryRow): LessonSummary => ({
  id: r.id,
  topicId: r.topic_id,
  subtopicId: r.subtopic_id,
  order: r.order_index,
  title: r.title,
  summary: r.summary,
  estMinutes: r.est_minutes,
  status: r.status ?? 'published',
});

export const toLesson = (r: LessonRow): Lesson => ({
  ...toLessonSummary(r),
  version: r.version,
  bodyMarkdown: r.body_markdown,
  keyTakeaways: r.key_takeaways ?? [],
  images: (r.images ?? []).map((i) => ({ file: i.file, altText: i.alt_text, credit: i.credit ?? null })),
  references: (r.references ?? []).map((s) => ({
    sourceId: s.source_id,
    title: s.title ?? s.source_id,
    url: s.url,
    pages: s.pages ?? [],
  })),
  quiz: (r.quiz ?? []).map((q) => ({ ...q, feedback: q.feedback ?? null })),
});

/** Order is decided by the backend data, never hard-coded in screens. */
export function buildLearningPath(
  topic: TopicSummary,
  subtopics: SubtopicRow[],
  lessons: LessonSummaryRow[],
): LearningPath {
  const paths: SubtopicPath[] = [...subtopics]
    .sort((a, b) => a.order_index - b.order_index)
    .map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order_index,
      lessons: lessons
        .filter((l) => l.subtopic_id === s.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map(toLessonSummary),
    }))
    .filter((s) => s.lessons.length > 0);
  return { topic, subtopics: paths, lessonIds: paths.flatMap((s) => s.lessons.map((l) => l.id)) };
}

// snake_case rows from the API (backend/docs/api-contract.md §3) -> app types.
// Lists are sorted by sort_order / order here, never by arrival order.
import type { LearningPath, Lesson, PathSubtopic, QuizItem, Topic } from './types';

export interface TopicRow {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export interface PathLessonRow {
  id: string;
  title: string;
  est_minutes: number;
  sort_order: number;
}

export interface PathSubtopicRow {
  id: string;
  name: string;
  sort_order: number;
  lessons: PathLessonRow[];
}

export interface LessonRow {
  id: string;
  version: number;
  subtopic_id: string;
  sort_order: number;
  title: string;
  est_minutes: number;
  pages: { order: number; body: string }[];
  key_takeaways: string[];
  images: { media_id: string; page: number; path: string; alt_text: string; credit: string | null }[];
  updated_at: string;
}

export interface QuizRow {
  id: string;
  lesson_id: string;
  question: string;
  options: string[];
  answer: number;
  feedback: string | null;
}

const bySortOrder = <T extends { sort_order: number }>(rows: T[]) =>
  [...rows].sort((a, b) => a.sort_order - b.sort_order);

export const toTopics = (rows: TopicRow[]): Topic[] =>
  bySortOrder(rows).map((r) => ({ id: r.id, name: r.name, icon: r.icon, sortOrder: r.sort_order }));

export function toLearningPath(rows: PathSubtopicRow[]): LearningPath {
  const subtopics: PathSubtopic[] = bySortOrder(rows)
    .map((s) => ({
      id: s.id,
      name: s.name,
      sortOrder: s.sort_order,
      lessons: bySortOrder(s.lessons ?? []).map((l) => ({
        id: l.id,
        title: l.title,
        estMinutes: l.est_minutes,
        sortOrder: l.sort_order,
      })),
    }))
    .filter((s) => s.lessons.length > 0);
  return { subtopics, lessonIds: subtopics.flatMap((s) => s.lessons.map((l) => l.id)) };
}

export const toLesson = (r: LessonRow): Lesson => ({
  id: r.id,
  version: r.version,
  subtopicId: r.subtopic_id,
  sortOrder: r.sort_order,
  title: r.title,
  estMinutes: r.est_minutes,
  pages: [...(r.pages ?? [])].sort((a, b) => a.order - b.order),
  keyTakeaways: r.key_takeaways ?? [],
  images: (r.images ?? []).map((i) => ({
    mediaId: i.media_id,
    page: i.page,
    path: i.path,
    altText: i.alt_text,
    credit: i.credit ?? null,
  })),
  updatedAt: r.updated_at,
});

export const toQuiz = (rows: QuizRow[]): QuizItem[] =>
  rows.map((q) => ({
    id: q.id,
    lessonId: q.lesson_id,
    question: q.question,
    options: q.options,
    answer: q.answer,
    feedback: q.feedback ?? null,
  }));

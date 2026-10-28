// Answers API requests from the Data pipeline's exports
// (schema/content.schema.json), shaped like the backend views in
// backend/supabase/migrations/0002_published_access.sql. This lets the team
// read real lessons in the app before they are imported and published.
// Unlike the real API it includes draft and checked lessons, which have not
// been clinically reviewed: use this mode for team review only.
// Metro needs static imports: add a line to EXPORTS for each new export file.
import symptoms from '../../../data/psa/chapters/03-symptoms-and-disease-progression/psa-symptoms-and-disease-progression.json';

import type { ApiRequest, Transport } from './api';
import type { LessonRow, PathSubtopicRow, QuizRow, TopicRow } from './mappers';
import { eqValue, simulated, type MockOptions } from './mockTransport';

/** The parts of an export the preview reads. */
export interface ContentExport {
  run: { generated_at: string };
  topics: {
    id: string;
    name: string;
    order: number;
    icon?: string | null;
    subtopics: { id: string; name: string; order: number; lesson_ids: string[] }[];
  }[];
  lessons: {
    id: string;
    subtopic_id: string;
    title: string;
    est_minutes: number;
    pages: { order: number; body: string }[];
    key_takeaways: string[];
    images?: { media_id: string; page: number }[];
  }[];
  quizzes: { id: string; lesson_id: string; question: string; options: string[]; answer: number; feedback: string }[];
  media: { id: string; file: string; alt_text: string; credit: string }[];
}

export const EXPORTS = [symptoms] as ContentExport[];

/** Builds the four API responses from a set of exports. */
export function exportResponder(exports: ContentExport[]) {
  const lessons = new Map(exports.flatMap((e) => e.lessons.map((l) => [l.id, { lesson: l, run: e.run }] as const)));
  const media = new Map(exports.flatMap((e) => e.media.map((m) => [m.id, m] as const)));
  const quizzes = exports.flatMap((e) => e.quizzes);
  const subtopics = exports.flatMap((e) => e.topics.flatMap((t) => t.subtopics.map((s) => ({ ...s, topicId: t.id }))));

  // Lesson order comes from its position in the subtopic's lesson_ids.
  const sortOrder = (lessonId: string) => {
    for (const s of subtopics) {
      const i = s.lesson_ids.indexOf(lessonId);
      if (i >= 0) return i + 1;
    }
    return 0;
  };

  const pathFor = (topicId: string): PathSubtopicRow[] =>
    subtopics
      .filter((s) => s.topicId === topicId)
      .map((s) => ({
        id: s.id,
        name: s.name,
        sort_order: s.order,
        lessons: s.lesson_ids
          .filter((id) => lessons.has(id))
          .map((id, i) => {
            const l = lessons.get(id)!.lesson;
            return { id, title: l.title, est_minutes: l.est_minutes, sort_order: i + 1 };
          }),
      }))
      .filter((s) => s.lessons.length > 0);

  const topics: TopicRow[] = exports
    .flatMap((e) => e.topics)
    .filter((t) => pathFor(t.id).length > 0)
    .map((t) => ({ id: t.id, name: t.name, icon: t.icon ?? null, sort_order: t.order }));

  const lessonRow = (id: string): LessonRow[] => {
    const found = lessons.get(id);
    if (!found) return [];
    const { lesson: l, run } = found;
    return [
      {
        id: l.id,
        version: 1,
        subtopic_id: l.subtopic_id,
        sort_order: sortOrder(l.id),
        title: l.title,
        est_minutes: l.est_minutes,
        pages: l.pages,
        key_takeaways: l.key_takeaways,
        images: (l.images ?? []).flatMap((img) => {
          const m = media.get(img.media_id);
          return m ? [{ media_id: m.id, page: img.page, path: m.file, alt_text: m.alt_text, credit: m.credit }] : [];
        }),
        updated_at: run.generated_at,
      },
    ];
  };

  const quizRows = (lessonId: string): QuizRow[] =>
    quizzes
      .filter((q) => q.lesson_id === lessonId)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(({ id, lesson_id, question, options, answer, feedback }) => ({ id, lesson_id, question, options, answer, feedback }));

  return (request: ApiRequest): unknown => {
    switch (request.path) {
      case 'v_topics':
        return topics;
      case 'rpc/get_learning_path':
        return pathFor((request.body as { p_topic_id?: string } | undefined)?.p_topic_id ?? '');
      case 'v_lessons':
        return lessonRow(eqValue(request, 'id') ?? '');
      case 'v_quiz_items':
        return quizRows(eqValue(request, 'lesson_id') ?? '');
      default:
        return null;
    }
  };
}

export function createPreviewTransport(options: MockOptions = {}, exports: ContentExport[] = EXPORTS): Transport {
  return simulated(exportResponder(exports), options);
}

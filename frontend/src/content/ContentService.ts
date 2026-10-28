import type { LearningPath, Lesson, QuizItem, Topic } from './types';

/** The only way screens get content. Built in src/content/index.ts. */
export interface ContentService {
  /** Published topics, ordered. */
  getTopics(): Promise<Topic[]>;
  /** Subtopics and lessons in reading order. Empty when nothing in the topic is published. */
  getLearningPath(topicId: string): Promise<LearningPath>;
  /** One lesson, or null when the id is unknown or not published. */
  getLesson(lessonId: string): Promise<Lesson | null>;
  /** Quiz items for a lesson; empty when it has none. */
  getQuiz(lessonId: string): Promise<QuizItem[]>;
}

/**
 * Decided by HTTP status, never by message text (api-contract.md §4).
 * NETWORK: no response after one retry, or a 5xx. CONFIG: 401/403 or missing settings.
 * BAD_REQUEST: 400, an app bug, so it is logged.
 */
export type ContentErrorCode = 'NETWORK' | 'CONFIG' | 'BAD_REQUEST' | 'UNKNOWN';

export class ContentError extends Error {
  constructor(public code: ContentErrorCode, message: string, public cause?: unknown) {
    super(message);
    this.name = 'ContentError';
  }
}

/** Patient-facing wording for each error code. */
export function describeError(error: unknown): string {
  const code = error instanceof ContentError ? error.code : 'UNKNOWN';
  switch (code) {
    case 'NETWORK':
      return 'We could not reach RheumNotes. Check your connection and try again.';
    case 'CONFIG':
      return 'The app is not set up correctly. Please contact the RheumNotes team.';
    default:
      return 'Something went wrong while loading this content.';
  }
}

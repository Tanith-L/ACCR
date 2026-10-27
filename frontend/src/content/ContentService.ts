import type { LearningPath, Lesson, TopicSummary } from './types';

/** The only way screens get content. Swap implementations in src/content/index.ts. */
export interface ContentService {
  /** Published topics, ordered. */
  getTopics(): Promise<TopicSummary[]>;
  /** Topic + its subtopics and lessons in learning order. Throws NOT_FOUND. */
  getLearningPath(topicId: string): Promise<LearningPath>;
  /** One full lesson. Throws NOT_FOUND. */
  getLesson(lessonId: string): Promise<Lesson>;
}

export type ContentErrorCode = 'NOT_FOUND' | 'NETWORK' | 'CONFIG' | 'UNKNOWN';

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
    case 'NOT_FOUND':
      return 'This content is not available right now.';
    case 'NETWORK':
      return 'We could not reach RheumNotes. Check your connection and try again.';
    case 'CONFIG':
      return 'The app is not set up correctly. Please contact the RheumNotes team.';
    default:
      return 'Something went wrong while loading this content.';
  }
}

// App-side content model. Mirrors the API contract in docs/api-contract.md:
// the Supabase views return snake_case rows, and src/content/mappers.ts turns
// them into these types. Screens only ever see these types.

export type ContentStatus = 'draft' | 'checked' | 'reviewed' | 'published';

export interface TopicSummary {
  id: string;
  diseaseId: string;
  name: string;
  description: string | null;
  icon: string | null;
  order: number;
  lessonCount: number;
  totalMinutes: number;
}

export interface LessonSummary {
  id: string;
  topicId: string;
  subtopicId: string;
  order: number;
  title: string;
  summary: string;
  estMinutes: number;
  /** Always 'published' from Supabase; mock/review mode can show earlier statuses. */
  status: ContentStatus;
}

export interface SubtopicPath {
  id: string;
  name: string;
  order: number;
  lessons: LessonSummary[];
}

export interface LearningPath {
  topic: TopicSummary;
  subtopics: SubtopicPath[];
  /** All lessons in reading order, flattened across subtopics. */
  lessonIds: string[];
}

export interface LessonImage {
  file: string;
  altText: string;
  credit: string | null;
}

export interface SourceReference {
  sourceId: string;
  title: string;
  url: string | null;
  pages: number[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answer: number;
  feedback: string | null;
}

export interface Lesson extends LessonSummary {
  version: number;
  bodyMarkdown: string;
  keyTakeaways: string[];
  images: LessonImage[];
  references: SourceReference[];
  quiz: QuizQuestion[];
}

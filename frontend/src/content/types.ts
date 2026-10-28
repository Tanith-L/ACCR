// App-side content model. Mirrors the API in backend/docs/api-contract.md:
// the endpoints return snake_case rows, and src/content/mappers.ts turns
// them into these types. Screens only ever see these types.
// Everything the API returns is published; drafts never reach the app.

export interface Topic {
  id: string;
  name: string;
  /** Icon names aren't agreed yet (project guide §11 #8); null until they are. */
  icon: string | null;
  sortOrder: number;
}

export interface PathLesson {
  id: string;
  title: string;
  estMinutes: number;
  sortOrder: number;
}

export interface PathSubtopic {
  id: string;
  name: string;
  sortOrder: number;
  lessons: PathLesson[];
}

export interface LearningPath {
  subtopics: PathSubtopic[];
  /** All lessons in reading order, flattened across subtopics. */
  lessonIds: string[];
}

export interface LessonPage {
  order: number;
  /** Plain text or simple Markdown. */
  body: string;
}

export interface LessonImage {
  mediaId: string;
  /** The lesson page (`LessonPage.order`) the image belongs to. */
  page: number;
  /** Path in the public `media` Storage bucket. */
  path: string;
  altText: string;
  credit: string | null;
}

export interface Lesson {
  id: string;
  version: number;
  subtopicId: string;
  sortOrder: number;
  title: string;
  estMinutes: number;
  pages: LessonPage[];
  keyTakeaways: string[];
  images: LessonImage[];
  updatedAt: string;
}

export interface QuizItem {
  id: string;
  lessonId: string;
  question: string;
  options: string[];
  /** 0-based index into `options`. */
  answer: number;
  feedback: string | null;
}

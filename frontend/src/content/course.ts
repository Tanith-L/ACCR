// Reads that span several endpoints. v_topics has no lesson lists and the quiz
// endpoint works per lesson, so these fan out over the single-item calls.
import type { ContentService } from './ContentService';
import type { LearningPath, Topic } from './types';

export interface CourseTopic {
  topic: Topic;
  /** Empty when the topic's path failed to load, so one bad topic doesn't hide the rest. */
  path: LearningPath;
}

export async function getCourse(service: ContentService): Promise<CourseTopic[]> {
  const topics = await service.getTopics();
  const paths = await Promise.all(topics.map((t) => service.getLearningPath(t.id).catch(() => null)));
  return topics.map((topic, i) => ({ topic, path: paths[i] ?? { subtopics: [], lessonIds: [] } }));
}

/** Whether any of the lessons has quiz questions. A failed check counts as no quiz. */
export async function hasQuiz(service: ContentService, lessonIds: string[]): Promise<boolean> {
  const quizzes = await Promise.all(lessonIds.map((id) => service.getQuiz(id).catch(() => [])));
  return quizzes.some((q) => q.length > 0);
}

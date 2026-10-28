// Screen 3: one lesson, one page at a time. The last page adds the key
// takeaways, the quiz, completion and "next lesson".
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { LessonImage } from '@/components/LessonImage';
import { Markdown } from '@/components/Markdown';
import { Screen } from '@/components/Screen';
import { AsyncContent, EmptyState } from '@/components/StateViews';
import { contentService, type Lesson, type QuizItem } from '@/content';
import { useAsync } from '@/hooks/useAsync';
import { useProgress } from '@/progress/ProgressContext';
import { colors, radius, spacing, type } from '@/theme';

export default function LessonScreen() {
  // `topicId` comes from the learning path; v_lessons doesn't return it.
  const { lessonId, topicId } = useLocalSearchParams<{ lessonId: string; topicId?: string }>();
  const state = useAsync(async () => {
    const [lesson, quiz, path] = await Promise.all([
      contentService.getLesson(lessonId),
      // Quiz and path are extras; the lesson still shows if they fail.
      contentService.getQuiz(lessonId).catch(() => []),
      topicId ? contentService.getLearningPath(topicId).catch(() => null) : null,
    ]);
    return { lesson, quiz, lessonIds: path?.lessonIds ?? [] };
  }, `${lessonId}/${topicId}`);

  return (
    <AsyncContent
      state={state}
      isEmpty={(d) => d.lesson === null}
      empty={
        <EmptyState
          title="This lesson isn't available"
          message="It may have been updated or removed. Go back and choose another lesson."
        />
      }
    >
      {({ lesson, quiz, lessonIds }) =>
        lesson && (
          // Keyed so the page resets when "Next lesson" or a refresh brings a new version.
          <LessonView
            key={`${lesson.id}@${lesson.version}`}
            lesson={lesson}
            quiz={quiz}
            lessonIds={lessonIds}
            topicId={topicId}
            onRefresh={state.reload}
          />
        )
      }
    </AsyncContent>
  );
}

interface ViewProps {
  lesson: Lesson;
  quiz: QuizItem[];
  lessonIds: string[];
  topicId: string | undefined;
  onRefresh: () => void;
}

function LessonView({ lesson, quiz, lessonIds, topicId, onRefresh }: ViewProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const { isCompleted, setCompleted } = useProgress();

  const page = lesson.pages[pageIndex];
  const isLastPage = pageIndex >= lesson.pages.length - 1;
  const done = isCompleted(lesson.id);
  const position = lessonIds.indexOf(lesson.id);
  const nextId = position >= 0 ? lessonIds[position + 1] : undefined;

  return (
    <Screen onRefresh={onRefresh} scrollKey={pageIndex}>
      <View style={styles.header}>
        {position >= 0 && (
          <Text style={type.label}>
            LESSON {position + 1} OF {lessonIds.length}
          </Text>
        )}
        <Text style={type.title}>{lesson.title}</Text>
        <Text style={type.caption}>
          {lesson.estMinutes} min read
          {lesson.pages.length > 1 ? ` · Page ${pageIndex + 1} of ${lesson.pages.length}` : ''}
        </Text>
      </View>

      {page && <Markdown source={page.body} />}
      {lesson.images
        .filter((image) => image.page === page?.order)
        .map((image) => (
          <LessonImage key={image.mediaId} image={image} />
        ))}

      {lesson.pages.length > 1 && (
        <View style={styles.pager}>
          {pageIndex > 0 && (
            <View style={styles.pagerButton}>
              <Button label="Previous" variant="secondary" onPress={() => setPageIndex(pageIndex - 1)} />
            </View>
          )}
          {!isLastPage && (
            <View style={styles.pagerButton}>
              <Button label="Next page" onPress={() => setPageIndex(pageIndex + 1)} />
            </View>
          )}
        </View>
      )}

      {isLastPage && (
        <>
          {lesson.keyTakeaways.length > 0 && (
            <View style={styles.takeaways}>
              <Text style={type.label}>KEY TAKEAWAYS</Text>
              {lesson.keyTakeaways.map((t) => (
                <Text key={t} style={type.body}>
                  • {t}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            {quiz.length > 0 && (
              <Button
                label={`Check your understanding (${quiz.length} ${quiz.length === 1 ? 'question' : 'questions'})`}
                variant="secondary"
                onPress={() => router.push({ pathname: '/quiz/[lessonId]', params: { lessonId: lesson.id } })}
              />
            )}
            <Button
              label={done ? 'Completed ✓  (tap to undo)' : 'Mark as complete'}
              variant={done ? 'secondary' : 'primary'}
              onPress={() => setCompleted({ id: lesson.id, topicId: topicId ?? '' }, !done)}
            />
            {nextId ? (
              <Button
                label="Next lesson"
                variant="secondary"
                onPress={() =>
                  router.replace({ pathname: '/lesson/[lessonId]', params: { lessonId: nextId, topicId } })
                }
              />
            ) : (
              <Button label="Back to learning path" variant="secondary" onPress={() => router.back()} />
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  pager: { flexDirection: 'row', gap: spacing.sm },
  pagerButton: { flex: 1 },
  takeaways: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  actions: { gap: spacing.sm, paddingTop: spacing.md },
});

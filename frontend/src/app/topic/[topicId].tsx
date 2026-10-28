// Screen 2: the learning path for one topic (subtopics -> ordered lessons).
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { LessonRow } from '@/components/LessonRow';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { AsyncContent, EmptyState } from '@/components/StateViews';
import { contentService } from '@/content';
import { useAsync } from '@/hooks/useAsync';
import { useProgress } from '@/progress/ProgressContext';
import { spacing, type } from '@/theme';

export default function LearningPathScreen() {
  // `name` comes from the topic list; the learning path endpoint doesn't return it.
  const { topicId, name } = useLocalSearchParams<{ topicId: string; name?: string }>();
  const path = useAsync(() => contentService.getLearningPath(topicId), topicId);
  const { isCompleted, countCompleted } = useProgress();

  const openLesson = (lessonId: string) =>
    router.push({ pathname: '/lesson/[lessonId]', params: { lessonId, topicId } });

  return (
    <>
      <Stack.Screen options={{ title: name ?? 'Learning path' }} />
      <AsyncContent
        state={path}
        isEmpty={(p) => p.lessonIds.length === 0}
        empty={<EmptyState title="No lessons in this topic yet" message="Check back soon." />}
      >
        {(p) => {
          const done = countCompleted(p.lessonIds);
          const next = p.lessonIds.find((id) => !isCompleted(id));
          let position = 0;
          return (
            <Screen onRefresh={path.reload}>
              <View style={styles.header}>
                {name ? <Text style={type.title}>{name}</Text> : null}
                <ProgressBar done={done} total={p.lessonIds.length} />
                {next && (
                  <Button label={done === 0 ? 'Start learning' : 'Continue'} onPress={() => openLesson(next)} />
                )}
              </View>
              {p.subtopics.map((sub) => (
                <View key={sub.id} style={styles.section}>
                  <Text style={type.label}>{sub.name.toUpperCase()}</Text>
                  {sub.lessons.map((lesson) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      position={++position}
                      completed={isCompleted(lesson.id)}
                      onPress={() => openLesson(lesson.id)}
                    />
                  ))}
                </View>
              ))}
            </Screen>
          );
        }}
      </AsyncContent>
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md },
  section: { gap: spacing.sm },
});

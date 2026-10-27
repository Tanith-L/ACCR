// Screen 3: one lesson, with completion and "next lesson" navigation.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { LessonImage } from '@/components/LessonImage';
import { Markdown } from '@/components/Markdown';
import { Screen } from '@/components/Screen';
import { SourceList } from '@/components/SourceList';
import { AsyncContent } from '@/components/StateViews';
import { StatusBanner } from '@/components/StatusBanner';
import { contentService } from '@/content';
import { useAsync } from '@/hooks/useAsync';
import { useProgress } from '@/progress/ProgressContext';
import { colors, radius, spacing, type } from '@/theme';

export default function LessonScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const state = useAsync(async () => {
    const lesson = await contentService.getLesson(lessonId);
    // The path is only needed for "next lesson"; the lesson still shows if it fails.
    const path = await contentService.getLearningPath(lesson.topicId).catch(() => null);
    return { lesson, path };
  }, lessonId);
  const { isCompleted, setCompleted } = useProgress();

  return (
    <>
      <Stack.Screen options={{ title: state.data?.path?.topic.name ?? 'Lesson' }} />
      <AsyncContent state={state}>
        {({ lesson, path }) => {
          const done = isCompleted(lesson.id);
          const ids = path?.lessonIds ?? [];
          const index = ids.indexOf(lesson.id);
          const nextId = index >= 0 ? ids[index + 1] : undefined;
          return (
            <Screen>
              <StatusBanner status={lesson.status} />
              <View style={styles.header}>
                {index >= 0 && (
                  <Text style={type.label}>
                    LESSON {index + 1} OF {ids.length}
                  </Text>
                )}
                <Text style={type.title}>{lesson.title}</Text>
                <Text style={type.caption}>{lesson.estMinutes} min read</Text>
              </View>

              <Markdown source={lesson.bodyMarkdown} />

              {lesson.images.map((image) => (
                <LessonImage key={image.file} image={image} />
              ))}

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

              <SourceList references={lesson.references} />

              <View style={styles.actions}>
                <Button
                  label={done ? 'Completed ✓  (tap to undo)' : 'Mark as complete'}
                  variant={done ? 'secondary' : 'primary'}
                  onPress={() => setCompleted(lesson, !done)}
                />
                {nextId ? (
                  <Button
                    label="Next lesson"
                    variant="secondary"
                    onPress={() => router.replace({ pathname: '/lesson/[lessonId]', params: { lessonId: nextId } })}
                  />
                ) : (
                  <Button label="Back to learning path" variant="secondary" onPress={() => router.back()} />
                )}
              </View>
            </Screen>
          );
        }}
      </AsyncContent>
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  takeaways: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  actions: { gap: spacing.sm, paddingTop: spacing.md },
});

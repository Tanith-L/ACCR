// Lesson: one page at a time (api-contract §3.3). The last page adds the key
// takeaways and the buttons to the next lesson or the knowledge check.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Card, InfoCard } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { LessonImage } from '@/components/LessonImage';
import { SourceLine } from '@/components/Logo';
import { Markdown } from '@/components/Markdown';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { AsyncContent } from '@/components/StateViews';
import { useToast } from '@/components/Toast';
import { contentService, type Lesson } from '@/content';
import { hasQuiz } from '@/content/course';
import { useAsync } from '@/hooks/useAsync';
import { usePreferences } from '@/preferences/PreferencesContext';
import { useProgress } from '@/progress/ProgressContext';
import { colors, spacing, type } from '@/theme';

type Params = {
  lessonId: string;
  /** From the topic screen; v_lessons doesn't return the topic. */
  topicId?: string;
  topicName?: string;
  /** Label for the back button: "Topic", "Lesson 1", "Quiz". */
  back?: string;
  /** The page (`LessonPage.order`) to open on, from the knowledge map. */
  page?: string;
};

export default function LessonScreen() {
  const params = useLocalSearchParams<Params>();
  const { lessonId, topicId } = params;
  const { quizzesEnabled } = usePreferences();
  const state = useAsync(async () => {
    const [lesson, path] = await Promise.all([
      contentService.getLesson(lessonId),
      // The path is only for "Lesson 1 of 2" and "Next lesson"; the lesson still shows if it fails.
      topicId ? contentService.getLearningPath(topicId).catch(() => null) : null,
    ]);
    const lessonIds = path?.lessonIds ?? [];
    // Asked only on a topic's last lesson, where the quiz follows.
    const quizNext = quizzesEnabled && lessonIds.at(-1) === lessonId && (await hasQuiz(contentService, lessonIds));
    return { lesson, lessonIds, quizNext };
  }, `${lessonId}/${topicId}/${quizzesEnabled}`);

  const position = state.data?.lessonIds.indexOf(lessonId) ?? -1;
  const total = state.data?.lessonIds.length ?? 0;
  const header = (
    <AppHeader backLabel={params.back ?? 'Topic'} title={position >= 0 ? `Lesson ${position + 1} of ${total}` : 'Lesson'} />
  );

  return (
    <AsyncContent
      state={state}
      header={header}
      isEmpty={(d) => d.lesson === null}
      empty={{
        title: 'This lesson isn’t available',
        message: 'It may have been updated or removed. Go back and choose another lesson.',
      }}
    >
      {({ lesson, lessonIds, quizNext }) =>
        lesson && (
          // Keyed so the page resets when a refresh brings a new version.
          <LessonView
            key={`${lesson.id}@${lesson.version}`}
            header={header}
            lesson={lesson}
            lessonIds={lessonIds}
            quizNext={quizNext}
            params={params}
            onRefresh={state.reload}
          />
        )
      }
    </AsyncContent>
  );
}

interface ViewProps {
  header: React.ReactNode;
  lesson: Lesson;
  lessonIds: string[];
  quizNext: boolean;
  params: Params;
  onRefresh: () => void;
}

function LessonView({ header, lesson, lessonIds, quizNext, params, onRefresh }: ViewProps) {
  const [pageIndex, setPageIndex] = useState(() =>
    Math.max(0, lesson.pages.findIndex((p) => String(p.order) === params.page)),
  );
  const { isCompleted, setCompleted } = useProgress();
  const showToast = useToast();
  const { topicId, topicName } = params;

  const page = lesson.pages[pageIndex];
  const isLastPage = pageIndex >= lesson.pages.length - 1;
  const position = lessonIds.indexOf(lesson.id);
  const nextId = position >= 0 ? lessonIds[position + 1] : undefined;

  const alreadyDone = isCompleted(lesson.id);
  const complete = () => {
    setCompleted({ id: lesson.id, topicId: topicId ?? '' }, true);
    if (!alreadyDone) showToast('Lesson finished. Nice work!');
  };
  const toTopic = () =>
    topicId
      ? router.dismissTo({ pathname: '/topic/[topicId]', params: { topicId, name: topicName } })
      : router.back();

  const forward = !isLastPage ? (
    <Button label="Next page" onPress={() => setPageIndex(pageIndex + 1)} />
  ) : nextId ? (
    <Button
      label="Next lesson"
      onPress={() => {
        complete();
        router.push({
          pathname: '/lesson/[lessonId]',
          params: { lessonId: nextId, topicId, topicName, back: `Lesson ${position + 1}` },
        });
      }}
    />
  ) : (
    <Button
      label="Finish lesson"
      onPress={() => {
        complete();
        if (quizNext && topicId) {
          router.push({ pathname: '/quiz/[topicId]', params: { topicId, topicName } });
        } else {
          toTopic();
        }
      }}
    />
  );

  const actions = (
    <>
      <View style={styles.navRow}>
        {pageIndex > 0 && (
          <View style={styles.navBack}>
            <Button label="Previous" variant="outline" onPress={() => setPageIndex(pageIndex - 1)} />
          </View>
        )}
        <View style={styles.navForward}>{forward}</View>
      </View>
      {isLastPage && !nextId && quizNext && <Button label="Return to Topic Home" variant="outline" onPress={toTopic} />}
    </>
  );

  return (
    <Screen header={header} actions={actions} onRefresh={onRefresh} scrollKey={pageIndex}>
      <View style={{ gap: spacing.md }}>
        {topicName ? <Text style={type.eyebrow}>{topicName}</Text> : null}
        <Text style={type.headline}>{lesson.title}</Text>
        {alreadyDone && (
          <View style={styles.done}>
            <Icon name="check-circle" size={16} color={colors.success} />
            <Text style={[type.caption, { color: colors.success }]}>Finished</Text>
          </View>
        )}
        {lesson.pages.length > 1 && (
          <View style={styles.pages}>
            <Text style={type.caption}>
              Page {pageIndex + 1} of {lesson.pages.length}
            </Text>
            <ProgressBar value={(pageIndex + 1) / lesson.pages.length} label={`Page ${pageIndex + 1} of ${lesson.pages.length}`} />
          </View>
        )}
      </View>

      {/* After the text, which introduces them as "the photo below". */}
      {page && (
        <Card>
          <Markdown source={page.body} />
        </Card>
      )}
      {lesson.images
        .filter((image) => image.page === page?.order)
        .map((image) => (
          <LessonImage key={image.mediaId} image={image} />
        ))}

      {isLastPage && lesson.keyTakeaways.length > 0 && (
        <InfoCard icon="bookmark" title={lesson.keyTakeaways.length === 1 ? 'Key takeaway' : 'Key takeaways'}>
          {lesson.keyTakeaways.length === 1 ? (
            lesson.keyTakeaways[0]
          ) : (
            <View style={{ gap: spacing.xs }}>
              {lesson.keyTakeaways.map((t) => (
                <Text key={t} style={type.body}>
                  • {t}
                </Text>
              ))}
            </View>
          )}
        </InfoCard>
      )}

      <SourceLine />
    </Screen>
  );
}

const styles = StyleSheet.create({
  done: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pages: { gap: spacing.xs + 2 },
  navRow: { flexDirection: 'row', gap: spacing.md },
  navBack: { flex: 2 },
  navForward: { flex: 3 },
});

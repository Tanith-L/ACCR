// Lesson: one page at a time (api-contract §3.3). The last page adds the key
// takeaways and the buttons to the next lesson or the knowledge check.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { InfoCard } from '@/components/Card';
import { LessonImage } from '@/components/LessonImage';
import { SourceLine } from '@/components/Logo';
import { Markdown } from '@/components/Markdown';
import { Screen } from '@/components/Screen';
import { AsyncContent } from '@/components/StateViews';
import { contentService, type Lesson } from '@/content';
import { useAsync } from '@/hooks/useAsync';
import { usePreferences } from '@/preferences/PreferencesContext';
import { useProgress } from '@/progress/ProgressContext';
import { spacing, type } from '@/theme';

type Params = {
  lessonId: string;
  /** From the topic screen; v_lessons doesn't return the topic. */
  topicId?: string;
  topicName?: string;
  /** Label for the back button: "Topic", "Lesson 1", "Quiz". */
  back?: string;
};

export default function LessonScreen() {
  const params = useLocalSearchParams<Params>();
  const { lessonId, topicId } = params;
  const state = useAsync(async () => {
    const [lesson, path] = await Promise.all([
      contentService.getLesson(lessonId),
      // The path is only for "Lesson 1 of 2" and "Next lesson"; the lesson still shows if it fails.
      topicId ? contentService.getLearningPath(topicId).catch(() => null) : null,
    ]);
    return { lesson, lessonIds: path?.lessonIds ?? [] };
  }, `${lessonId}/${topicId}`);

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
      {({ lesson, lessonIds }) =>
        lesson && (
          // Keyed so the page resets when a refresh brings a new version.
          <LessonView
            key={`${lesson.id}@${lesson.version}`}
            header={header}
            lesson={lesson}
            lessonIds={lessonIds}
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
  params: Params;
  onRefresh: () => void;
}

function LessonView({ header, lesson, lessonIds, params, onRefresh }: ViewProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const { setCompleted } = useProgress();
  const { quizzesEnabled } = usePreferences();
  const { topicId, topicName } = params;

  const page = lesson.pages[pageIndex];
  const isLastPage = pageIndex >= lesson.pages.length - 1;
  const position = lessonIds.indexOf(lesson.id);
  const nextId = position >= 0 ? lessonIds[position + 1] : undefined;
  const isLastLesson = position >= 0 && !nextId;

  const complete = () => setCompleted({ id: lesson.id, topicId: topicId ?? '' }, true);
  const toTopic = () =>
    topicId
      ? router.dismissTo({ pathname: '/topic/[topicId]', params: { topicId, name: topicName } })
      : router.back();

  const actions = !isLastPage ? (
    <>
      <Button label="Continue" onPress={() => setPageIndex(pageIndex + 1)} />
      {pageIndex > 0 && <Button label="Previous page" variant="link" onPress={() => setPageIndex(pageIndex - 1)} />}
    </>
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
    <>
      <Button
        label="Finish lesson"
        onPress={() => {
          complete();
          if (quizzesEnabled && topicId) {
            router.push({ pathname: '/quiz/[topicId]', params: { topicId, topicName } });
          } else {
            toTopic();
          }
        }}
      />
      {isLastLesson && <Button label="Return to Topic Home" variant="outline" onPress={toTopic} />}
    </>
  );

  return (
    <Screen header={header} actions={actions} onRefresh={onRefresh} scrollKey={pageIndex}>
      <View style={{ gap: spacing.md }}>
        {topicName ? <Text style={type.eyebrow}>{topicName}</Text> : null}
        <Text style={type.headline}>{lesson.title}</Text>
        {lesson.pages.length > 1 && (
          <Text style={type.caption}>
            Page {pageIndex + 1} of {lesson.pages.length}
          </Text>
        )}
      </View>

      {lesson.images
        .filter((image) => image.page === page?.order)
        .map((image) => (
          <LessonImage key={image.mediaId} image={image} />
        ))}
      {page && <Markdown source={page.body} />}

      {isLastPage && lesson.keyTakeaways.length > 0 && (
        <InfoCard title={lesson.keyTakeaways.length === 1 ? 'Key takeaway' : 'Key takeaways'}>
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

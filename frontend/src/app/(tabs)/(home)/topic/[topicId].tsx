// Topic: its body map when it has one, its lessons in reading order, and the optional quiz note.
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { BodyMap } from '@/components/BodyMap';
import { Button } from '@/components/Button';
import { InfoCard } from '@/components/Card';
import { LessonRow } from '@/components/LessonRow';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { AsyncContent } from '@/components/StateViews';
import { contentService } from '@/content';
import { hasQuiz } from '@/content/course';
import { useAsync } from '@/hooks/useAsync';
import { usePreferences } from '@/preferences/PreferencesContext';
import { useProgress } from '@/progress/ProgressContext';
import { spacing, type } from '@/theme';
import { plural } from '@/utils/format';

/** The topic about working with the care team, which links to the Care Team tab. */
const CARE_TEAM_TOPIC_ID = 'contact';

export default function TopicScreen() {
  // `name` comes from Home; the learning path endpoint doesn't return it.
  const { topicId, name } = useLocalSearchParams<{ topicId: string; name?: string }>();
  const { isCompleted } = useProgress();
  const { quizzesEnabled } = usePreferences();
  const state = useAsync(async () => {
    const path = await contentService.getLearningPath(topicId);
    const [map, quiz] = await Promise.all([
      // The map is an extra on top of the lesson list, so the topic still shows without it.
      contentService.getTopicImageMap(topicId).catch(() => null),
      quizzesEnabled && hasQuiz(contentService, path.lessonIds),
    ]);
    return { path, map, quiz };
  }, `${topicId}/${quizzesEnabled}`);

  const header = <AppHeader backLabel="Topics" title="Topic" />;
  const openLesson = (lessonId: string) =>
    router.push({ pathname: '/lesson/[lessonId]', params: { lessonId, topicId, topicName: name, back: 'Topic' } });

  return (
    <AsyncContent
      state={state}
      header={header}
      isEmpty={({ path }) => path.lessonIds.length === 0}
      empty={{ title: 'No lessons here yet', message: 'Check back soon. New lessons are on their way.' }}
    >
      {({ path: p, map, quiz }) => {
        const count = p.lessonIds.length;
        const done = p.lessonIds.filter(isCompleted).length;
        const grouped = p.subtopics.length > 1;
        let position = 0;
        return (
          <Screen header={header} onRefresh={state.reload}>
            {name ? <Text style={type.title}>{name}</Text> : null}
            <Text style={type.lead}>
              {count === 1 ? 'One short lesson.' : `${plural(count, 'short lesson').replace(/^./, (c) => c.toUpperCase())}. Read them in any order.`}
            </Text>
            <ProgressBar
              value={done / count}
              label={`${done} of ${count} lessons finished`}
            />
            <Text style={type.caption}>
              {done} of {count} lessons finished
            </Text>

            {map && (
              <BodyMap map={map} isCompleted={isCompleted} onOpenLesson={openLesson} />
            )}
            {topicId === CARE_TEAM_TOPIC_ID && (
              <Button label="Need help now? Go to Care Team" variant="outline" onPress={() => router.navigate('/care')} />
            )}

            {p.subtopics.map((sub) => (
              <View key={sub.id} style={{ gap: spacing.md }}>
                {grouped && <Text style={type.eyebrow}>{sub.name}</Text>}
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

            {quiz && (
              <InfoCard title="Quiz is optional">
                After the lessons, you can take a short quiz or skip it and return to Topic Home.
              </InfoCard>
            )}
          </Screen>
        );
      }}
    </AsyncContent>
  );
}

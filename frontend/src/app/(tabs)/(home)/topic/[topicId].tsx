// Topic: its lessons in reading order, and the optional quiz note.
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { InfoCard } from '@/components/Card';
import { LessonRow } from '@/components/LessonRow';
import { Screen } from '@/components/Screen';
import { AsyncContent } from '@/components/StateViews';
import { contentService } from '@/content';
import { useAsync } from '@/hooks/useAsync';
import { usePreferences } from '@/preferences/PreferencesContext';
import { useProgress } from '@/progress/ProgressContext';
import { spacing, type } from '@/theme';
import { numberWord } from '@/utils/format';

export default function TopicScreen() {
  // `name` comes from Home; the learning path endpoint doesn't return it.
  const { topicId, name } = useLocalSearchParams<{ topicId: string; name?: string }>();
  const path = useAsync(() => contentService.getLearningPath(topicId), topicId);
  const { isCompleted } = useProgress();
  const { quizzesEnabled } = usePreferences();

  const header = <AppHeader backLabel="Topics" title="Topic" />;
  const openLesson = (lessonId: string) =>
    router.push({ pathname: '/lesson/[lessonId]', params: { lessonId, topicId, topicName: name, back: 'Topic' } });

  return (
    <AsyncContent
      state={path}
      header={header}
      isEmpty={(p) => p.lessonIds.length === 0}
      empty={{ title: 'No lessons here yet', message: 'Check back soon. New lessons are on their way.' }}
    >
      {(p) => {
        const count = p.lessonIds.length;
        const grouped = p.subtopics.length > 1;
        let position = 0;
        return (
          <Screen header={header} onRefresh={path.reload}>
            {name ? <Text style={type.display}>{name}</Text> : null}
            <Text style={type.lead}>
              {count === 1
                ? 'This topic has one short lesson with visuals and key takeaways.'
                : `Complete these ${numberWord(count)} short lessons in any order. Each lesson opens a focused page with visuals and key takeaways.`}
            </Text>

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

            {quizzesEnabled && (
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

// Home: the learning topics with progress per topic.
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { AsyncContent } from '@/components/StateViews';
import { TopicCard } from '@/components/TopicCard';
import { contentService } from '@/content';
import { useAsync } from '@/hooks/useAsync';
import { useProgress } from '@/progress/ProgressContext';
import { colors, fonts, radius, spacing, type } from '@/theme';
import { percent, plural } from '@/utils/format';

export default function HomeScreen() {
  // Percentages need each topic's lesson list; v_topics has no lesson count.
  const state = useAsync(async () => {
    const topics = await contentService.getTopics();
    const paths = await Promise.all(topics.map((t) => contentService.getLearningPath(t.id).catch(() => null)));
    return topics.map((topic, i) => ({ topic, lessonIds: paths[i]?.lessonIds ?? [] }));
  }, 'home');
  const { countCompleted } = useProgress();

  return (
    <AsyncContent
      state={state}
      isEmpty={(list) => list.length === 0}
      empty={{ title: 'No lessons yet', message: 'New lessons will appear here soon.' }}
    >
      {(list) => {
        const totals = list.map(({ lessonIds }) => ({ done: countCompleted(lessonIds), total: lessonIds.length }));
        const started = totals.filter((t) => t.done > 0).length;
        const overall = percent(
          totals.reduce((s, t) => s + t.done, 0),
          totals.reduce((s, t) => s + t.total, 0),
        );
        return (
          <Screen onRefresh={state.reload}>
            <Text style={type.title}>Your learning topics</Text>
            <Text style={type.lead}>Start with the recommended topic or choose what matters to you today.</Text>

            <View style={styles.summary} accessibilityLabel={`${started} of ${list.length} topics started, ${overall} percent complete`}>
              <Text style={styles.summaryText}>
                {plural(list.length, 'topic', `${started} of ${list.length}`)} started
              </Text>
              <Text style={styles.summaryText}>{overall}%</Text>
            </View>

            {list.map(({ topic, lessonIds }, i) => (
              <TopicCard
                key={topic.id}
                name={topic.name}
                subtitle={plural(lessonIds.length, 'short lesson')}
                percent={percent(totals[i].done, totals[i].total)}
                onPress={() =>
                  router.push({ pathname: '/topic/[topicId]', params: { topicId: topic.id, name: topic.name } })
                }
              />
            ))}
          </Screen>
        );
      }}
    </AsyncContent>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg + 4,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  summaryText: { fontFamily: fonts.semibold, fontSize: 19, color: colors.primary },
});

// Home: a friendly welcome, overall progress, the knowledge map and the topics.
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { AsyncContent } from '@/components/StateViews';
import { topicIcon, TopicCard } from '@/components/TopicCard';
import { contentService } from '@/content';
import { getCourse } from '@/content/course';
import { useAsync } from '@/hooks/useAsync';
import { useProgress } from '@/progress/ProgressContext';
import { colors, fonts, radius, spacing, type } from '@/theme';

/** Encouraging, never a score to worry about. */
function encouragement(done: number, total: number): string {
  if (done === 0) return 'Start with any topic, whenever you feel ready.';
  if (done === total) return 'You finished every lesson. You can come back anytime.';
  return 'Nice work. Pick up wherever you like.';
}

export default function HomeScreen() {
  const state = useAsync(() => getCourse(contentService), 'home');
  const { countCompleted } = useProgress();

  return (
    <AsyncContent
      state={state}
      isEmpty={(list) => list.length === 0}
      empty={{ title: 'No lessons yet', message: 'New lessons will appear here soon.' }}
    >
      {(list) => {
        const done = list.reduce((sum, { path }) => sum + countCompleted(path.lessonIds), 0);
        const total = list.reduce((sum, { path }) => sum + path.lessonIds.length, 0);
        return (
          <Screen onRefresh={state.reload}>
            <Text style={type.display}>Welcome</Text>
            <Text style={type.lead}>Short, simple lessons about living with psoriatic arthritis, at your own pace.</Text>

            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>
                {done} of {total} lessons finished
              </Text>
              <ProgressBar value={total ? done / total : 0} label={`${done} of ${total} lessons finished`} trackColor={colors.surface} />
              <Text style={styles.summaryText}>{encouragement(done, total)}</Text>
            </View>

            <Card onPress={() => router.push('/mind-map')} accessibilityLabel="Open the knowledge map">
              <View style={styles.mapRow}>
                <Icon name="share-2" size={24} color={colors.primary} />
                <View style={styles.mapText}>
                  <Text style={type.heading}>Knowledge map</Text>
                  <Text style={type.caption}>See how PsA fits together, on one screen.</Text>
                </View>
                <Icon name="chevron-right" size={22} color={colors.textMuted} />
              </View>
            </Card>

            <Text style={type.heading} accessibilityRole="header">
              Topics
            </Text>
            {list.map(({ topic, path }) => (
              <TopicCard
                key={topic.id}
                name={topic.name}
                icon={topicIcon(topic.id, topic.icon)}
                done={countCompleted(path.lessonIds)}
                total={path.lessonIds.length}
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
  summary: { gap: spacing.sm + 2, padding: spacing.lg + 2, borderRadius: radius.lg, backgroundColor: colors.primarySoft },
  summaryTitle: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, color: colors.primary },
  summaryText: { ...type.caption, color: colors.primary },
  mapRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mapText: { flex: 1, gap: 2 },
});

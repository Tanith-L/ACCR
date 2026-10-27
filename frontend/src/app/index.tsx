// Screen 1: topic selection.
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { AsyncContent, EmptyState } from '@/components/StateViews';
import { TopicCard } from '@/components/TopicCard';
import { contentService, contentSource } from '@/content';
import { useAsync } from '@/hooks/useAsync';
import { useProgress } from '@/progress/ProgressContext';
import { colors, spacing, type } from '@/theme';

export default function TopicsScreen() {
  const topics = useAsync(() => contentService.getTopics(), 'topics');
  const { countCompletedInTopic } = useProgress();

  return (
    <AsyncContent
      state={topics}
      isEmpty={(list) => list.length === 0}
      empty={<EmptyState title="No lessons yet" message="New lessons will appear here once they are published." />}
    >
      {(list) => (
        <Screen onRefresh={topics.reload}>
          <View style={styles.intro}>
            <Text style={type.title}>Learn about psoriatic arthritis</Text>
            <Text style={type.caption}>Choose a topic. Lessons take a few minutes each.</Text>
          </View>
          {list.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              completed={countCompletedInTopic(topic.id)}
              onPress={() => router.push({ pathname: '/topic/[topicId]', params: { topicId: topic.id } })}
            />
          ))}
          {contentSource === 'mock' && (
            <Text style={styles.mode}>Preview mode: showing local content, including unreviewed drafts.</Text>
          )}
        </Screen>
      )}
    </AsyncContent>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.xs },
  mode: { ...type.caption, color: colors.warning, textAlign: 'center' },
});

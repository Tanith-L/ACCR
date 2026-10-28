// Screen 4: the quiz for one lesson. Answers stay on this screen only;
// nothing is stored or sent (no study tables until Phase 3).
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { QuizQuestion } from '@/components/QuizQuestion';
import { Screen } from '@/components/Screen';
import { AsyncContent, EmptyState } from '@/components/StateViews';
import { contentService, type QuizItem } from '@/content';
import { useAsync } from '@/hooks/useAsync';
import { colors, radius, spacing, type } from '@/theme';

export default function QuizScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const quiz = useAsync(() => contentService.getQuiz(lessonId), lessonId);

  return (
    <AsyncContent
      state={quiz}
      isEmpty={(items) => items.length === 0}
      empty={<EmptyState title="No quiz for this lesson" />}
    >
      {(items) => <QuizView items={items} onRefresh={quiz.reload} />}
    </AsyncContent>
  );
}

function QuizView({ items, onRefresh }: { items: QuizItem[]; onRefresh: () => void }) {
  const [picks, setPicks] = useState<Record<string, number>>({});
  const answered = items.filter((q) => q.id in picks).length;
  const correct = items.filter((q) => picks[q.id] === q.answer).length;

  return (
    <Screen onRefresh={onRefresh}>
      <Text style={type.title}>Check your understanding</Text>
      {items.map((item, i) => (
        <QuizQuestion
          key={item.id}
          item={item}
          number={i + 1}
          selected={picks[item.id]}
          onSelect={(index) => setPicks((p) => ({ ...p, [item.id]: index }))}
        />
      ))}
      {answered === items.length && (
        <View style={styles.result} accessibilityLiveRegion="polite">
          <Text style={type.heading}>
            You got {correct} of {items.length} right
          </Text>
        </View>
      )}
      <Button label="Back to lesson" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  result: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center' },
});

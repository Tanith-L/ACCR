import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TopicSummary } from '@/content';
import { colors, radius, spacing, type } from '@/theme';

import { ProgressBar } from './ProgressBar';

interface Props {
  topic: TopicSummary;
  completed: number;
  onPress: () => void;
}

export function TopicCard({ topic, completed, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${topic.name}, ${topic.lessonCount} lessons, ${completed} completed`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{topic.order}</Text>
        </View>
        <View style={styles.titles}>
          <Text style={type.heading}>{topic.name}</Text>
          <Text style={type.caption}>
            {topic.lessonCount} lessons · about {topic.totalMinutes} min
          </Text>
        </View>
      </View>
      {topic.description ? <Text style={styles.description}>{topic.description}</Text> : null}
      <ProgressBar done={completed} total={topic.lessonCount} showLabel={false} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.primary, fontWeight: '700', fontSize: 17 },
  titles: { flex: 1, gap: 2 },
  description: { ...type.body, color: colors.textMuted },
});

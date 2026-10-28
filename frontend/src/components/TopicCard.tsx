import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Topic } from '@/content';
import { colors, radius, spacing, type } from '@/theme';

interface Props {
  topic: Topic;
  /** 1-based position in the list; shown until topic icons are agreed. */
  position: number;
  completed: number;
  onPress: () => void;
}

export function TopicCard({ topic, position, completed, onPress }: Props) {
  const status = completed > 0 ? `${completed} ${completed === 1 ? 'lesson' : 'lessons'} completed` : 'Not started';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${topic.name}, ${status}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{position}</Text>
      </View>
      <View style={styles.titles}>
        <Text style={type.heading}>{topic.name}</Text>
        <Text style={type.caption}>{status}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85 },
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
  chevron: { fontSize: 28, color: colors.textMuted },
});

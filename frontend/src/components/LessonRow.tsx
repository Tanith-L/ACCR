import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LessonSummary } from '@/content';
import { colors, radius, spacing, type } from '@/theme';

interface Props {
  lesson: LessonSummary;
  position: number;
  completed: boolean;
  onPress: () => void;
}

export function LessonRow({ lesson, position, completed, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Lesson ${position}: ${lesson.title}${completed ? ', completed' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.marker, completed && styles.markerDone]}>
        <Text style={[styles.markerText, completed && styles.markerTextDone]}>{completed ? '✓' : position}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{lesson.title}</Text>
        <Text style={type.caption} numberOfLines={2}>
          {lesson.summary}
        </Text>
        <Text style={styles.meta}>{lesson.estMinutes} min read</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85 },
  marker: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDone: { backgroundColor: colors.success, borderColor: colors.success },
  markerText: { color: colors.primary, fontWeight: '700' },
  markerTextDone: { color: colors.primaryText },
  text: { flex: 1, gap: spacing.xs },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  meta: { ...type.caption, fontSize: 13 },
});

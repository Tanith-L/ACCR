import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type } from '@/theme';

export function ProgressBar({ done, total, showLabel = true }: { done: number; total: number; showLabel?: boolean }) {
  const ratio = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: done }}
      accessibilityLabel={`${done} of ${total} lessons completed`}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View>
      {showLabel && (
        <Text style={styles.label}>
          {done} of {total} lessons completed
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.success },
  label: type.caption,
});

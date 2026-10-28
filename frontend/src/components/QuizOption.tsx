import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, radius, type } from '@/theme';

/** Radio-style answer card on the quiz question screen. */
export function QuizOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, selected && styles.selected, pressed && !selected && styles.pressed]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.dot} />}</View>
      <Text style={[type.body, styles.label]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.primarySoft },
  pressed: { backgroundColor: colors.background },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderWidth: 2 },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.primary },
  label: { flex: 1 },
});

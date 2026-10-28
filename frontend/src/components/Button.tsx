import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing } from '@/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  accessibilityHint?: string;
}

export function Button({ label, onPress, variant = 'primary', accessibilityHint }: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.base, primary ? styles.primary : styles.secondary, pressed && styles.pressed]}
    >
      <Text style={[styles.label, { color: primary ? colors.primaryText : colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  label: { fontSize: 17, fontWeight: '600' },
});

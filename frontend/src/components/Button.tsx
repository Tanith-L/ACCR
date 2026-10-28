import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius, spacing } from '@/theme';

interface Props {
  label: string;
  onPress: () => void;
  /** primary: filled teal. outline: white with a teal border. link: teal text only. */
  variant?: 'primary' | 'outline' | 'link';
  disabled?: boolean;
  accessibilityHint?: string;
}

export function Button({ label, onPress, variant = 'primary', disabled, accessibilityHint }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && {
          backgroundColor: disabled ? colors.primaryDisabled : pressed ? colors.primaryPressed : colors.primary,
        },
        variant === 'outline' && [styles.outline, pressed && { backgroundColor: colors.primarySoft }],
        variant === 'link' && pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.label, { color: variant === 'primary' ? colors.primaryText : colors.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
  label: { fontFamily: fonts.semibold, fontSize: 17 },
});

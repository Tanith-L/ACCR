import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, type } from '@/theme';

/** White card with a hairline border. Pass onPress to make the whole card tappable. */
export function Card({
  title,
  children,
  onPress,
  accessibilityLabel,
  style,
}: {
  title?: string;
  children?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const content = (
    <>
      {title ? <Text style={type.heading}>{title}</Text> : null}
      {children}
    </>
  );
  if (!onPress) return <View style={[styles.card, style]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, style, pressed && { backgroundColor: colors.background }]}
    >
      {content}
    </Pressable>
  );
}

/**
 * Tinted note: "Key takeaway", "Quiz is optional", "Why this matters".
 * `alert` is the white card with a red border used for urgent guidance.
 */
export function InfoCard({
  title,
  children,
  tone = 'info',
}: {
  title?: string;
  children?: ReactNode;
  tone?: 'info' | 'alert';
}) {
  const alert = tone === 'alert';
  return (
    <View style={[styles.info, alert && styles.alert]}>
      {title ? <Text style={[type.heading, { color: alert ? colors.danger : colors.primary }]}>{title}</Text> : null}
      {typeof children === 'string' ? <Text style={type.body}>{children}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  info: { gap: spacing.sm, padding: spacing.lg + 2, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  alert: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger },
});

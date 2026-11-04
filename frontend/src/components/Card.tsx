import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadows, spacing, type } from '@/theme';

import { Icon, type IconName } from './Icon';

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
      style={({ pressed }) => [styles.card, style, pressed && styles.cardPressed]}
    >
      {content}
    </Pressable>
  );
}

/**
 * Tinted note: "Key takeaway", "Quiz is optional", "Why this matters".
 * `alert` is the light card with a red border used for urgent guidance.
 */
export function InfoCard({
  title,
  icon,
  children,
  tone = 'info',
}: {
  title?: string;
  icon?: IconName;
  children?: ReactNode;
  tone?: 'info' | 'alert';
}) {
  const alert = tone === 'alert';
  return (
    <View style={[styles.info, alert && styles.alert]}>
      {title ? (
        <View style={styles.infoTitle}>
          {icon && <Icon name={icon} size={20} color={alert ? colors.danger : colors.primary} />}
          <Text style={[type.heading, styles.infoTitleText, { color: alert ? colors.danger : colors.primary }]}>{title}</Text>
        </View>
      ) : null}
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
    ...shadows.card,
  },
  cardPressed: { backgroundColor: colors.primarySoft, transform: [{ scale: 0.99 }] },
  infoTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoTitleText: { flex: 1 },
  info: { gap: spacing.sm, padding: spacing.lg + 2, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  alert: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger },
});

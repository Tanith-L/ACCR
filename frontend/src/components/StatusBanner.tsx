import { StyleSheet, Text, View } from 'react-native';

import type { ContentStatus } from '@/content';
import { colors, radius, spacing } from '@/theme';

const LABELS: Record<Exclude<ContentStatus, 'published'>, string> = {
  draft: 'Preview — AI draft that has not passed automatic checks. Not clinically reviewed.',
  checked: 'Preview — passed automatic checks, waiting for clinical review.',
  reviewed: 'Preview — clinically reviewed, not yet published.',
};

/** Only appears in the mock/review environment; Supabase serves published content only. */
export function StatusBanner({ status }: { status: ContentStatus }) {
  if (status === 'published') return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.warningSoft, borderRadius: radius.sm, padding: spacing.md },
  text: { color: colors.warning, fontSize: 14, fontWeight: '600' },
});

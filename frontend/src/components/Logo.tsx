import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing, type } from '@/theme';

/** The RHEUMNOTES© wordmark in small caps. `badge` sits on a teal tile (Welcome screen). */
export function Logo({ variant = 'badge' }: { variant?: 'badge' | 'inline' }) {
  const badge = variant === 'badge';
  const color = badge ? colors.primaryText : colors.text;
  const big = badge ? 19 : 17;
  const word = (
    <Text style={[styles.word, { color, fontSize: big }]} accessibilityLabel="RheumNotes">
      RHEUM<Text style={{ fontSize: big * 0.78 }}>NOTES</Text>
      <Text style={{ fontSize: big * 0.5 }}>©</Text>
    </Text>
  );
  return badge ? <View style={styles.badge}>{word}</View> : word;
}

/** "source: RHEUMNOTES©" under lessons and answer reviews. */
export function SourceLine() {
  return (
    <View style={styles.source}>
      <Text style={[type.caption, { color: colors.text }]}>source: </Text>
      <Logo variant="inline" />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  word: { fontFamily: fonts.serif, letterSpacing: 0.3 },
  source: { flexDirection: 'row', alignItems: 'baseline' },
});

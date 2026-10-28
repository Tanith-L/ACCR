import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/theme';

export function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

export function ChipRow({ labels }: { labels: string[] }) {
  return (
    <View style={styles.row}>
      {labels.map((l) => (
        <Chip key={l} label={l} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  text: { fontFamily: fonts.regular, fontSize: 15, color: colors.primary },
});

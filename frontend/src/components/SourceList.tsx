import { Linking, StyleSheet, Text, View } from 'react-native';

import type { SourceReference } from '@/content';
import { colors, spacing, type } from '@/theme';

const pageLabel = (pages: number[]) =>
  pages.length === 0 ? '' : pages.length === 1 ? `, p. ${pages[0]}` : `, pp. ${pages.join(', ')}`;

export function SourceList({ references }: { references: SourceReference[] }) {
  if (references.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={type.label}>SOURCES</Text>
      {references.map((ref) => (
        <Text
          key={ref.sourceId}
          style={[type.caption, ref.url ? styles.link : null]}
          onPress={ref.url ? () => Linking.openURL(ref.url!) : undefined}
          accessibilityRole={ref.url ? 'link' : 'text'}
        >
          {ref.title}
          {pageLabel(ref.pages)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  link: { color: colors.primary, textDecorationLine: 'underline' },
});

import { StyleSheet, Text, View } from 'react-native';

import { InfoCard } from '@/components/Card';
import { colors, spacing, type } from '@/theme';

/** The lesson's own key takeaways (from the content), as a recap after the text. */
export function KeyTakeaways({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <InfoCard icon="bookmark" title={items.length === 1 ? 'Key takeaway' : 'Key takeaways'}>
      <View style={styles.list}>
        {items.map((t) => (
          <View key={t} style={styles.item}>
            <View style={styles.dot} />
            <Text style={[type.body, styles.text]}>{t}</Text>
          </View>
        ))}
      </View>
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  item: { flexDirection: 'row', gap: spacing.md },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 11, backgroundColor: colors.primary },
  text: { flex: 1 },
});

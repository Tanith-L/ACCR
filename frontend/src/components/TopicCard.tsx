import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing, type } from '@/theme';

import { Card } from './Card';

interface Props {
  name: string;
  /** Line under the name. The API has no topic description yet, so screens pass the lesson count. */
  subtitle: string;
  percent: number;
  onPress: () => void;
}

export function TopicCard({ name, subtitle, percent, onPress }: Props) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${name}, ${percent} percent complete`}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.name}>{name}</Text>
          <Text style={type.caption}>{subtitle}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.percent}>{percent}%</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: spacing.xs },
  name: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 25, color: colors.text },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: { fontFamily: fonts.medium, fontSize: 14, color: colors.primary },
});

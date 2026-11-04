import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing, type } from '@/theme';

import { Card } from './Card';
import { Icon, isIconName, type IconName } from './Icon';
import { ProgressBar } from './ProgressBar';

// The API's icon field isn't in use yet (api-contract §3.1). Until it is, these
// fit the current topics, and any other topic gets the book.
const TOPIC_ICONS: Record<string, IconName> = {
  dx: 'search',
  overview: 'info',
  symptoms: 'activity',
  treatment: 'heart',
  education: 'book-open',
  contact: 'phone-call',
};

export function topicIcon(topicId: string, icon: string | null): IconName {
  return isIconName(icon) ? icon : (TOPIC_ICONS[topicId] ?? 'book-open');
}

interface Props {
  name: string;
  icon: IconName;
  done: number;
  total: number;
  onPress: () => void;
}

export function TopicCard({ name, icon, done, total, onPress }: Props) {
  const finished = total > 0 && done === total;
  const status = finished ? 'All lessons finished' : `${done} of ${total} lessons finished`;
  return (
    <Card onPress={onPress} accessibilityLabel={`${name}. ${status}`}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Icon name={icon} size={24} color={colors.primary} />
        </View>
        <Text style={styles.name}>{name}</Text>
        <Icon name="chevron-right" size={22} color={colors.textMuted} />
      </View>
      <View style={styles.progress}>
        <ProgressBar value={total ? done / total : 0} label={status} />
        <View style={styles.status}>
          {finished && <Icon name="check-circle" size={16} color={colors.success} />}
          <Text style={[type.caption, finished && { color: colors.success }]}>{status}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  name: { flex: 1, fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, color: colors.text },
  progress: { gap: spacing.xs + 2, paddingTop: spacing.xs },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});

import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { colors, radius, spacing, type } from '@/theme';

interface Props {
  title: string;
  topicName?: string;
  estMinutes: number;
  videoMinutes?: number;
  finished: boolean;
  /** Reports where the title ends, so the header can show it once it scrolls away. */
  onTitleLayout?: (bottom: number) => void;
}

function Meta({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.meta}>
      <Icon name={icon} size={15} color={colors.textMuted} />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

/** Topic, lesson title and what the lesson holds. No summary text is invented here. */
export function LessonIntro({ title, topicName, estMinutes, videoMinutes, finished, onTitleLayout }: Props) {
  const onLayout = (e: LayoutChangeEvent) => onTitleLayout?.(e.nativeEvent.layout.y + e.nativeEvent.layout.height);
  return (
    <View style={styles.wrap}>
      {topicName ? (
        <Text style={type.eyebrow} maxFontSizeMultiplier={1.4}>
          {topicName}
        </Text>
      ) : null}
      <Text style={styles.title} accessibilityRole="header" onLayout={onLayout}>
        {title}
      </Text>
      <View style={styles.metaRow}>
        <Meta icon="book-open" label={`${estMinutes} min read`} />
        {videoMinutes ? <Meta icon="play-circle" label={`${videoMinutes} min video`} /> : null}
        {finished ? (
          <View style={styles.done} accessibilityLabel="You finished this lesson">
            <Icon name="check-circle" size={15} color={colors.success} />
            <Text style={[styles.metaText, { color: colors.success }]}>Finished</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { ...type.headline, fontSize: 26, lineHeight: 32 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.lg, rowGap: spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...type.caption },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
});

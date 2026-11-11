import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { colors, fonts, minTouch, radius, spacing, type } from '@/theme';

export type UpNext =
  | { kind: 'lesson'; title: string; onPress: () => void }
  | { kind: 'quiz'; onPress: () => void }
  | { kind: 'topic'; onPress: () => void };

interface Props {
  finished: boolean;
  onComplete: () => void;
  onUndo: () => void;
  upNext: UpNext;
}

const NEXT: Record<UpNext['kind'], { eyebrow: string; icon: IconName }> = {
  lesson: { eyebrow: 'Up next', icon: 'arrow-right' },
  quiz: { eyebrow: 'Last lesson in this topic', icon: 'check-square' },
  topic: { eyebrow: 'Last lesson in this topic', icon: 'list' },
};

/**
 * End of the lesson: marking it complete and moving on are separate actions.
 * Completion is only ever recorded by pressing the button, never by scrolling.
 */
export function LessonActions({ finished, onComplete, onUndo, upNext }: Props) {
  const next = NEXT[upNext.kind];
  const title = upNext.kind === 'lesson' ? upNext.title : upNext.kind === 'quiz' ? 'Take the knowledge check' : 'Back to the topic';
  return (
    <View style={styles.wrap}>
      {finished ? (
        <View style={styles.doneRow} accessibilityLiveRegion="polite">
          <View style={styles.doneLabel}>
            <Icon name="check-circle" size={22} color={colors.success} />
            <Text style={styles.doneText}>Lesson complete</Text>
          </View>
          <Pressable
            onPress={onUndo}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Mark this lesson as not complete"
            style={({ pressed }) => [styles.undo, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.undoText}>Undo</Text>
          </Pressable>
        </View>
      ) : (
        <Button label="Mark lesson complete" onPress={onComplete} accessibilityHint="Saves this lesson as finished on this device" />
      )}

      <Pressable
        onPress={upNext.onPress}
        accessibilityRole="button"
        accessibilityLabel={`${next.eyebrow}: ${title}`}
        style={({ pressed }) => [styles.next, pressed && styles.nextPressed]}
      >
        <View style={styles.nextText}>
          <Text style={type.eyebrow}>{next.eyebrow}</Text>
          <Text style={type.heading} numberOfLines={2}>
            {title}
          </Text>
        </View>
        <View style={styles.nextIcon}>
          <Icon name={next.icon} size={20} color={colors.primary} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  doneRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  doneLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  doneText: { fontFamily: fonts.semibold, fontSize: 17, color: colors.success },
  undo: { minHeight: minTouch, justifyContent: 'center', paddingHorizontal: spacing.sm },
  undoText: { fontFamily: fonts.medium, fontSize: 16, color: colors.primary },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  nextPressed: { backgroundColor: colors.primarySoft },
  nextText: { flex: 1, gap: 2 },
  nextIcon: {
    width: minTouch,
    height: minTouch,
    borderRadius: minTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
});

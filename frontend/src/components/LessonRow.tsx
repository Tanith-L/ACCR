import { StyleSheet, Text, View } from 'react-native';

import type { PathLesson } from '@/content';
import { colors, fonts, spacing, type } from '@/theme';

import { Card } from './Card';
import { Icon } from './Icon';

interface Props {
  lesson: PathLesson;
  position: number;
  completed: boolean;
  onPress: () => void;
}

/** Numbered lesson card on the topic screen; the number turns into a check when done. */
export function LessonRow({ lesson, position, completed, onPress }: Props) {
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`Lesson ${position}: ${lesson.title}, ${lesson.estMinutes} minute read${completed ? ', completed' : ''}`}
    >
      <View style={styles.row}>
        <View style={[styles.number, completed && styles.numberDone]}>
          {completed ? (
            <Icon name="check" size={18} color={colors.primaryText} />
          ) : (
            <Text style={styles.numberText}>{position}</Text>
          )}
        </View>
        <View style={styles.text}>
          <Text style={type.heading}>{lesson.title}</Text>
          <Text style={type.caption}>{lesson.estMinutes} min read</Text>
        </View>
        <Icon name="chevron-right" size={20} color={colors.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md + 2 },
  number: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberDone: { backgroundColor: colors.primary },
  numberText: { fontFamily: fonts.regular, fontSize: 17, color: colors.primary },
  text: { flex: 1, gap: 2 },
});

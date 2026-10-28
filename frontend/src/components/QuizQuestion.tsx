import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { QuizItem } from '@/content';
import { colors, radius, spacing, type } from '@/theme';

interface Props {
  item: QuizItem;
  number: number;
  /** Index the patient picked, or undefined before they answer. */
  selected: number | undefined;
  onSelect: (index: number) => void;
}

/** One question. The answer locks after the first pick and the feedback shows. */
export function QuizQuestion({ item, number, selected, onSelect }: Props) {
  const answered = selected !== undefined;
  const correct = selected === item.answer;

  return (
    <View style={styles.card}>
      <Text style={type.label}>QUESTION {number}</Text>
      <Text style={type.heading}>{item.question}</Text>
      <View style={styles.options} accessibilityRole="radiogroup">
        {item.options.map((option, i) => {
          const isAnswer = answered && i === item.answer;
          const isWrongPick = answered && i === selected && !correct;
          return (
            <Pressable
              key={i}
              accessibilityRole="radio"
              accessibilityState={{ checked: i === selected, disabled: answered }}
              disabled={answered}
              onPress={() => onSelect(i)}
              style={({ pressed }) => [
                styles.option,
                pressed && styles.pressed,
                isAnswer && styles.optionCorrect,
                isWrongPick && styles.optionWrong,
              ]}
            >
              <Text style={type.body}>{option}</Text>
              {isAnswer && <Text style={styles.mark}>✓</Text>}
              {isWrongPick && <Text style={[styles.mark, styles.markWrong]}>✗</Text>}
            </Pressable>
          );
        })}
      </View>
      {answered && (
        <View style={[styles.feedback, correct ? styles.feedbackCorrect : styles.feedbackWrong]} accessibilityLiveRegion="polite">
          <Text style={[styles.verdict, { color: correct ? colors.success : colors.danger }]}>
            {correct ? 'Correct' : 'Not quite'}
          </Text>
          {item.feedback ? <Text style={type.body}>{item.feedback}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85 },
  optionCorrect: { borderColor: colors.success, backgroundColor: colors.successSoft },
  optionWrong: { borderColor: colors.danger },
  mark: { fontSize: 18, fontWeight: '700', color: colors.success },
  markWrong: { color: colors.danger },
  feedback: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md },
  feedbackCorrect: { backgroundColor: colors.successSoft },
  feedbackWrong: { backgroundColor: colors.warningSoft },
  verdict: { fontSize: 15, fontWeight: '700' },
});

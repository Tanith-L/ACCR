// Knowledge check for a topic: intro -> question -> answer review, repeated.
// Questions are the v_quiz_items of every lesson in the topic. Answers stay
// on this screen; nothing is stored or sent (no study tables until Phase 3).
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Bubble } from '@/components/Bubble';
import { Button } from '@/components/Button';
import { InfoCard } from '@/components/Card';
import { ChipRow } from '@/components/Chip';
import { SourceLine } from '@/components/Logo';
import { ProgressBar } from '@/components/ProgressBar';
import { QuizOption } from '@/components/QuizOption';
import { Screen } from '@/components/Screen';
import { AsyncContent } from '@/components/StateViews';
import { contentService, type QuizItem } from '@/content';
import { useAsync } from '@/hooks/useAsync';
import { colors, spacing, type } from '@/theme';
import { numberWord, plural } from '@/utils/format';

export default function QuizScreen() {
  const { topicId, topicName } = useLocalSearchParams<{ topicId: string; topicName?: string }>();
  const state = useAsync(async () => {
    const path = await contentService.getLearningPath(topicId);
    const perLesson = await Promise.all(path.lessonIds.map((id) => contentService.getQuiz(id)));
    return perLesson.flat();
  }, topicId);

  const toTopic = () => router.dismissTo({ pathname: '/topic/[topicId]', params: { topicId, name: topicName } });

  return (
    <AsyncContent
      state={state}
      header={<AppHeader backLabel="Lesson" title="Knowledge Check" />}
      isEmpty={(items) => items.length === 0}
      empty={{ title: 'No questions yet', message: 'This topic doesn’t have a quiz yet.' }}
    >
      {(items) => <Quiz items={items} topicId={topicId} topicName={topicName} onDone={toTopic} />}
    </AsyncContent>
  );
}

type Phase = { name: 'intro' } | { name: 'question'; index: number } | { name: 'review'; index: number; picked: number };

interface QuizProps {
  items: QuizItem[];
  topicId: string;
  topicName?: string;
  onDone: () => void;
}

function Quiz({ items, topicId, topicName, onDone }: QuizProps) {
  const [phase, setPhase] = useState<Phase>({ name: 'intro' });
  const [selected, setSelected] = useState<number>();
  // Questions answered correctly on the first try, for the private score.
  const [firstTry, setFirstTry] = useState<Record<string, boolean>>({});

  const total = items.length;

  if (phase.name === 'intro') {
    const minutes = Math.max(1, Math.round(total * 0.7));
    return (
      <Screen
        header={<AppHeader backLabel="Lesson" title="Knowledge Check" />}
        actions={
          <>
            <Button label="Start quiz" onPress={() => setPhase({ name: 'question', index: 0 })} />
            <Button label="Skip for now" variant="outline" onPress={onDone} />
          </>
        }
      >
        <Bubble icon="help-circle" />
        <Text style={type.display}>Ready for a quick check?</Text>
        <Text style={type.lead}>
          Try {total === 1 ? 'one question' : `${numberWord(total)} questions`} to reinforce what you learned. Your
          score is private and does not affect access to any content.
        </Text>
        <ChipRow labels={[plural(total, 'question'), `About ${plural(minutes, 'minute')}`, 'Retake anytime']} />
        <InfoCard title="Completely optional">You can skip the quiz and return directly to Topic Home.</InfoCard>
      </Screen>
    );
  }

  const item = items[phase.index];

  if (phase.name === 'question') {
    return (
      <Screen
        header={<AppHeader backLabel="Exit" onBack={onDone} title={`Question ${phase.index + 1} of ${total}`} />}
        actions={
          <Button
            label="Check answer"
            disabled={selected === undefined}
            onPress={() => {
              if (selected === undefined) return;
              setFirstTry((f) => (item.id in f ? f : { ...f, [item.id]: selected === item.answer }));
              setPhase({ name: 'review', index: phase.index, picked: selected });
            }}
          />
        }
      >
        <ProgressBar value={(phase.index + 1) / total} label={`Question ${phase.index + 1} of ${total}`} />
        <Text style={type.headline}>{item.question}</Text>
        <View style={{ gap: spacing.md }} accessibilityRole="radiogroup">
          {item.options.map((option, i) => (
            <QuizOption key={i} label={option} selected={selected === i} onPress={() => setSelected(i)} />
          ))}
        </View>
      </Screen>
    );
  }

  const correct = phase.picked === item.answer;
  const isLast = phase.index === total - 1;
  const score = items.filter((q) => firstTry[q.id]).length;
  const retry = () => {
    setSelected(undefined);
    setPhase({ name: 'question', index: phase.index });
  };
  const next = () => {
    setSelected(undefined);
    setPhase({ name: 'question', index: phase.index + 1 });
  };
  const reviewLesson = () =>
    router.push({ pathname: '/lesson/[lessonId]', params: { lessonId: item.lessonId, topicId, topicName, back: 'Quiz' } });

  return (
    <Screen
      header={<AppHeader backLabel="Quiz" onBack={retry} title="Answer Review" />}
      actions={
        <>
          {!correct ? (
            <Button label="Try again" onPress={retry} />
          ) : isLast ? (
            <Button label="Return to Topic Home" onPress={onDone} />
          ) : (
            <Button label="Next question" onPress={next} />
          )}
          <Button label="Review the lesson" variant="link" onPress={reviewLesson} />
        </>
      }
    >
      <Bubble icon={correct ? 'check' : 'x'} tone={correct ? 'success' : 'danger'} />
      <Text style={[type.display, { color: correct ? colors.success : colors.danger }]} accessibilityRole="alert">
        {correct ? 'Correct' : 'Not quite yet'}
      </Text>
      <Text style={type.body}>
        {correct ? (item.feedback ?? 'That’s the best answer.') : `The best answer is: ${item.options[item.answer]}`}
      </Text>
      {/* The API has one feedback text per question; it explains the answer when the pick was wrong. */}
      {!correct && item.feedback ? <InfoCard title="Why this matters">{item.feedback}</InfoCard> : null}
      <SourceLine />
      {correct && isLast && (
        <Text style={type.lead}>
          You answered {score} of {total} correctly on the first try. You can retake the quiz anytime.
        </Text>
      )}
    </Screen>
  );
}

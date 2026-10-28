// First launch: what the app is, and whether to include the optional quizzes.
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Card, InfoCard } from '@/components/Card';
import { ChipRow } from '@/components/Chip';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { usePreferences } from '@/preferences/PreferencesContext';
import { type } from '@/theme';

export default function WelcomeScreen() {
  const { completeOnboarding } = usePreferences();

  const choose = (quizzes: boolean) => {
    completeOnboarding(quizzes);
    router.replace('/');
  };

  return (
    <Screen
      standalone
      actions={
        <>
          <Button label="Include quizzes" onPress={() => choose(true)} />
          <Button label="Skip quizzes" variant="outline" onPress={() => choose(false)} />
          <Text style={styles.disclaimer}>
            Educational information only. Contact your care team for personal medical advice.
          </Text>
        </>
      }
    >
      <Logo />
      <Text style={type.display}>Understand your Psoriatic Arthritis</Text>
      <Text style={type.lead}>
        Learn about your diagnosis, symptoms, treatment, and flare management in short, patient-friendly steps.
      </Text>
      <ChipRow labels={['Short lessons', 'Visual guides', 'Optional quizzes']} />
      <Card title="Learn at your pace">
        <Text style={type.lead}>Choose any topic from the home page. Your progress is saved automatically.</Text>
      </Card>
      <InfoCard title="Include quick quizzes?">
        Test your understanding with short quizzes. You can change this later in Settings.
      </InfoCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  disclaimer: { ...type.caption, textAlign: 'center' },
});

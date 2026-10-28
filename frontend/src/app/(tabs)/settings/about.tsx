import Constants from 'expo-constants';
import { Text } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card, InfoCard } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { type } from '@/theme';

export default function AboutScreen() {
  return (
    <Screen header={<AppHeader backLabel="Settings" />}>
      <Text style={type.display}>About this RheumNotes App</Text>
      <Card title="Learning designed around your care">
        <Text style={type.lead}>
          Explore education topics, review key ideas, try optional quizzes, and understand when to contact your care
          team.
        </Text>
      </Card>
      {/* TODO(data): list the approved source documents once the content pipeline provides them. */}
      <Card title="Citations">
        <Text style={type.lead}>The sources behind each lesson will be listed here.</Text>
      </Card>
      <InfoCard>This educational app supports conversations with your care team. It does not replace medical advice.</InfoCard>
      <Text style={type.caption}>Version {Constants.expoConfig?.version ?? '1.0'}</Text>
    </Screen>
  );
}

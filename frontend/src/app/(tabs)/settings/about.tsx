import Constants from 'expo-constants';
import { Text } from 'react-native';

import { GENERAL_INFORMATION_NOTICE } from '@/components/AfterHoursNotice';
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
      <Card title="About ACCR">
        <Text style={type.body}>
          The Altoona Center for Clinical Research (ACCR) is a clinical research center in Pennsylvania focused on
          arthritis and related conditions. RheumNotes was built for ACCR by a student team at Carnegie Mellon
          University, to help people with psoriatic arthritis understand their condition. The lessons draw on education
          materials from Dr. Frederick Murphy, a rheumatologist with ACCR.
        </Text>
      </Card>
      {/* TODO(data): add a "Citations" card listing the approved source documents once the content
          pipeline provides them (Figma: About screen). */}
      <InfoCard>{GENERAL_INFORMATION_NOTICE}</InfoCard>
      <Text style={type.caption}>Version {Constants.expoConfig?.version ?? '1.0'}</Text>
    </Screen>
  );
}

// Care Team tab: when to contact the clinic. Static, clinic-approved guidance
// (not lesson content), so it lives in the app rather than the database.
import { StyleSheet, Text } from 'react-native';

import { InfoCard } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { type } from '@/theme';

// TODO(frontend): the clinic's approved phone number and hours, e.g. '(814) 555-0100 · Mon–Fri 8am–5pm'.
// Shown under the clinic name once filled in.
const CLINIC_CONTACT: string | null = null;

export default function CareScreen() {
  return (
    <Screen>
      <Text style={type.display}>When to contact the care team</Text>
      <Text style={type.lead}>
        Follow the clinic-approved guidance below. This app does not replace urgent or emergency care.
      </Text>
      <InfoCard title="Routine question">
        Medication instructions, appointment timing, or questions that can wait for a normal response.
      </InfoCard>
      <InfoCard title="Contact the clinic soon">
        New or worsening swelling, pain, stiffness, skin changes, or possible medication side effects.
      </InfoCard>
      <InfoCard title="Urgent or emergency symptoms" tone="alert">
        Use the emergency instructions provided by the clinic. Do not wait for an in-app response.
      </InfoCard>
      <Text style={styles.clinic}>
        Altoona Center for Clinical Research
        {CLINIC_CONTACT ? `\n${CLINIC_CONTACT}` : ''}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  clinic: { ...type.body, textAlign: 'center' },
});

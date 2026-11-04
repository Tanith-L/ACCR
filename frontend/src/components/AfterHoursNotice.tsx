// The After-Hours Notice, word for word from RheumNotes_After_Hours_Disclaimer.pdf
// (Nov 4, 2026; final legal review pending). It is safety text: change it only when
// that document changes. It is shown on the Care Team tab.
import { StyleSheet, Text, View } from 'react-native';

import { fonts, spacing, type } from '@/theme';

import { InfoCard } from './Card';

/** The notice's first paragraph, also shown on its own in About. */
export const GENERAL_INFORMATION_NOTICE =
  'This app provides general health information only. It does not replace your doctor, does not create a doctor-patient relationship, and is not monitored by a healthcare provider.';

export function AfterHoursNotice() {
  return (
    <InfoCard title="After-Hours Notice" tone="alert">
      <View style={styles.body}>
        <Text style={type.body}>{GENERAL_INFORMATION_NOTICE}</Text>
        <Text style={type.body}>
          <Text style={styles.strong}>
            If you think you have an emergency, call 911 (or your local emergency number) or go to the nearest emergency
            room right away.
          </Text>{' '}
          That includes chest pain, trouble breathing, fainting, sudden weakness or confusion, a severe allergic reaction,
          or sudden vision loss. If you are having thoughts of harming yourself, call or text 988.
        </Text>
        <Text style={type.body}>
          A hot, swollen joint with fever needs care the same day. Call your doctor&apos;s after-hours line, go to urgent
          care, or go to the emergency room.
        </Text>
        <Text style={type.body}>
          For a painful flare that is not an emergency, call your doctor&apos;s after-hours line or go to urgent care.
          Don&apos;t stop or change your medicines, especially steroids or immune-suppressing medicines, unless a
          healthcare provider tells you to.
        </Text>
        <Text style={type.body}>If you&apos;re not sure, seek care right away.</Text>
      </View>
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  strong: { fontFamily: fonts.semibold },
});

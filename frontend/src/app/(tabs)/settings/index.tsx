import { router } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { usePreferences } from '@/preferences/PreferencesContext';
import { colors, spacing, type } from '@/theme';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={type.lead}>{label}</Text>
      <Text style={[type.body, styles.value]}>{value}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { quizzesEnabled, setQuizzesEnabled } = usePreferences();

  return (
    <Screen>
      <Text style={type.eyebrow}>ACCR patient education</Text>
      <Text style={type.display}>Settings</Text>
      <Text style={type.lead}>Manage your profile and choose how learning activities appear.</Text>

      {/* No sign-in in Week 9 and no PHI on the device (project guide §3), so no name or email yet. */}
      <Card title="User information">
        <Row label="Care clinic" value="ACCR" />
        <Row label="Account" value="Coming soon" />
      </Card>

      <Card title="Preferences">
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={type.heading}>Include quizzes</Text>
            <Text style={type.caption}>Show optional quizzes in topics.</Text>
          </View>
          <Switch
            value={quizzesEnabled}
            onValueChange={setQuizzesEnabled}
            accessibilityLabel="Include quizzes"
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.border}
          />
        </View>
      </Card>

      <Button label="About this app" variant="outline" onPress={() => router.push('/settings/about')} />
      <Text style={type.caption}>Quiz visibility can be changed at any time.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingTop: spacing.xs },
  value: { flexShrink: 1, textAlign: 'right' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.xs },
  toggleText: { flex: 1, gap: 2 },
});

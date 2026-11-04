import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import { usePreferences } from '@/preferences/PreferencesContext';
import { useProgress } from '@/progress/ProgressContext';
import { colors, spacing, type } from '@/theme';

export default function SettingsScreen() {
  const { quizzesEnabled, setQuizzesEnabled } = usePreferences();
  const { resetProgress } = useProgress();

  const showToast = useToast();
  // Confirmed on the screen rather than with Alert, which does nothing on web.
  const [confirmingReset, setConfirmingReset] = useState(false);

  const reset = () => {
    resetProgress();
    setConfirmingReset(false);
    showToast('Progress reset');
  };

  return (
    <Screen>
      <Text style={type.eyebrow}>Patient education</Text>
      <Text style={type.display}>Settings</Text>
      <Text style={type.lead}>Choose how learning activities appear.</Text>

      {/* TODO(frontend): add a user information card once sign-in exists (Phase 3). Until then there
          is no account and no PHI on the device (project guide §3). */}
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
      {confirmingReset ? (
        <Card title="Reset progress?">
          <Text style={type.body}>All lessons will be marked as not started. This cannot be undone.</Text>
          <Button label="Yes, reset" onPress={reset} />
          <Button label="Cancel" variant="outline" onPress={() => setConfirmingReset(false)} />
        </Card>
      ) : (
        <Button label="Reset progress" variant="link" onPress={() => setConfirmingReset(true)} />
      )}
      <Text style={type.caption}>Quiz visibility can be changed at any time.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.xs },
  toggleText: { flex: 1, gap: 2 },
});

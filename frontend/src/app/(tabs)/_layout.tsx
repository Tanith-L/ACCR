import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { TabBar } from '@/components/TabBar';
import { usePreferences } from '@/preferences/PreferencesContext';
import { colors } from '@/theme';

// Open on Home, the middle tab, rather than the first one (Care Team).
export const unstable_settings = { initialRouteName: '(home)' };

export default function TabsLayout() {
  const { ready, onboarded } = usePreferences();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!onboarded) return <Redirect href="/welcome" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="care" />
      <Tabs.Screen name="(home)" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

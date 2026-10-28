import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { PreferencesProvider } from '@/preferences/PreferencesContext';
import { ProgressProvider } from '@/progress/ProgressContext';
import { colors } from '@/theme';

export default function RootLayout() {
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  // A blank screen for the moment fonts load; if they fail, carry on with the system font.
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <PreferencesProvider>
      <ProgressProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
        </Stack>
      </ProgressProvider>
    </PreferencesProvider>
  );
}

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ProgressProvider } from '@/progress/ProgressContext';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <ProgressProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
          headerStyle: { backgroundColor: colors.surface },
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'RheumNotes' }} />
        <Stack.Screen name="topic/[topicId]" options={{ title: 'Learning path' }} />
        <Stack.Screen name="lesson/[lessonId]" options={{ title: 'Lesson' }} />
        <Stack.Screen name="quiz/[lessonId]" options={{ title: 'Quiz' }} />
      </Stack>
    </ProgressProvider>
  );
}

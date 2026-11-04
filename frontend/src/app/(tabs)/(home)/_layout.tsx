import { Stack } from 'expo-router';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors } from '@/theme';

/** Home tab: topics -> topic -> lesson -> knowledge check. Headers are drawn by each screen. */
export default function HomeLayout() {
  const reducedMotion = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: reducedMotion ? 'none' : 'default',
      }}
    />
  );
}

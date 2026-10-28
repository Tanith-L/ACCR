import { Stack } from 'expo-router';

import { colors } from '@/theme';

/** Home tab: topics -> topic -> lesson -> knowledge check. Headers are drawn by each screen. */
export default function HomeLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}

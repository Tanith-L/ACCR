import { router, type Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius, spacing } from '@/theme';

import { Icon, type IconName } from './Icon';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; icon: IconName }> = {
  care: { label: 'Care Team', icon: 'user-plus' },
  '(home)': { label: 'Home', icon: 'home' },
  settings: { label: 'Settings', icon: 'settings' },
};

/** Care Team · Home · Settings, with a soft teal pill behind the active tab. */
export function TabBar({ state, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const onPress = () => {
          if (!focused) navigateToTab(route.key);
          // Tapping the active tab again goes back to its first screen.
          else if (router.canDismiss()) router.dismissAll();
        };
        const tint = focused ? colors.primary : colors.textMuted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={onPress}
            style={[styles.tab, focused && styles.active]}
          >
            <Icon name={tab.icon} size={22} color={tint} />
            <Text style={[styles.label, { color: tint }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: spacing.sm, borderRadius: radius.md },
  active: { backgroundColor: colors.primarySoft },
  label: { fontFamily: fonts.medium, fontSize: 13 },
});

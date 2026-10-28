import { useEffect, useRef, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

interface Props {
  children: ReactNode;
  /** An <AppHeader />, shown above the scrolling content. */
  header?: ReactNode;
  /** Buttons that sit at the bottom of the screen when content is short, and after it when long. */
  actions?: ReactNode;
  /** Pass for pull-to-refresh. */
  onRefresh?: () => void;
  /** Scrolls back to the top whenever this changes (e.g. the lesson page). */
  scrollKey?: string | number;
  /** Screens outside the tab bar (Welcome) must clear the home indicator themselves. */
  standalone?: boolean;
}

export function Screen({ children, header, actions, onRefresh, scrollKey, standalone }: Props) {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [scrollKey]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      {header ? <View style={styles.header}>{header}</View> : null}
      <ScrollView
        ref={scroll}
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          { paddingTop: header ? spacing.md : spacing.xl },
          { paddingBottom: (standalone ? insets.bottom : 0) + spacing.xl },
        ]}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined
        }
      >
        <View style={styles.body}>{children}</View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xl },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, gap: spacing.xl },
  body: { gap: spacing.lg + 2 },
  actions: { marginTop: 'auto', gap: spacing.md },
});

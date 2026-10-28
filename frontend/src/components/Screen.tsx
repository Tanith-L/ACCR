import { useEffect, useRef, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

interface Props {
  children: ReactNode;
  /** Pass for pull-to-refresh. */
  onRefresh?: () => void;
  /** Scrolls back to the top whenever this changes (e.g. the lesson page). */
  scrollKey?: string | number;
}

/** Scrollable page body under the stack header. */
export function Screen({ children, onRefresh, scrollKey }: Props) {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [scrollKey]);

  return (
    <ScrollView
      ref={scroll}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      refreshControl={onRefresh ? <RefreshControl refreshing={false} onRefresh={onRefresh} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
});

import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { describeError } from '@/content';
import type { AsyncState } from '@/hooks/useAsync';
import { colors, spacing, type } from '@/theme';

import { Button } from './Button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (__DEV__) console.warn(error);
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Text style={styles.title}>Couldn’t load this</Text>
      <Text style={styles.caption}>{describeError(error)}</Text>
      {onRetry && <Button label="Try again" variant="secondary" onPress={onRetry} />}
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.caption}>{message}</Text>}
    </View>
  );
}

/** Loading -> error -> empty -> content, the same way on every screen. */
export function AsyncContent<T>({
  state,
  isEmpty,
  empty,
  children,
}: {
  state: AsyncState<T>;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (state.loading && state.data === undefined) return <LoadingState />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (state.data === undefined) return <LoadingState />;
  if (isEmpty?.(state.data)) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return <>{children(state.data)}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: { ...type.heading, textAlign: 'center' },
  caption: { ...type.caption, textAlign: 'center' },
});

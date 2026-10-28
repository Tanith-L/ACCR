import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContentError, describeError } from '@/content';
import type { AsyncState } from '@/hooks/useAsync';
import { colors, spacing, type } from '@/theme';

import { Bubble } from './Bubble';
import { Button } from './Button';

/** Keeps the screen's header (and so its back button) above a loading, error or empty state. */
function Frame({ header, children }: { header?: ReactNode; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.frame, { paddingTop: insets.top + spacing.sm }]}>
      {header ? <View style={styles.header}>{header}</View> : null}
      <View style={styles.center}>{children}</View>
    </View>
  );
}

export function LoadingState({ header }: { header?: ReactNode }) {
  return (
    <Frame header={header}>
      <View accessibilityLiveRegion="polite" accessibilityLabel="Loading">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </Frame>
  );
}

export function ErrorState({ error, onRetry, header }: { error: unknown; onRetry?: () => void; header?: ReactNode }) {
  console.warn(error); // contract §4: a 400 is an app bug and should be logged
  const offline = error instanceof ContentError && error.code === 'NETWORK';
  return (
    <Frame header={header}>
      <Bubble icon={offline ? 'wifi-off' : 'alert-circle'} size={88} />
      <Text style={styles.title} accessibilityRole="alert">
        {offline ? 'You seem to be offline' : 'Something went wrong'}
      </Text>
      <Text style={styles.message}>{describeError(error)}</Text>
      {onRetry && (
        <View style={styles.action}>
          <Button label="Try again" variant="outline" onPress={onRetry} />
        </View>
      )}
    </Frame>
  );
}

export function EmptyState({ title, message, header }: { title: string; message?: string; header?: ReactNode }) {
  return (
    <Frame header={header}>
      <Bubble icon="book-open" size={88} />
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
    </Frame>
  );
}

/** Loading -> error -> empty -> content, the same way on every screen. */
export function AsyncContent<T>({
  state,
  header,
  isEmpty,
  empty,
  children,
}: {
  state: AsyncState<T>;
  /** The screen's <AppHeader />, also shown while loading and on errors. */
  header?: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: { title: string; message?: string };
  children: (data: T) => ReactNode;
}) {
  if (state.loading && state.data === undefined) return <LoadingState header={header} />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} header={header} />;
  if (state.data === undefined) return <LoadingState header={header} />;
  if (isEmpty?.(state.data)) return <EmptyState {...(empty ?? { title: 'Nothing here yet' })} header={header} />;
  return <>{children(state.data)}</>;
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md },
  title: { ...type.headline, textAlign: 'center', marginTop: spacing.sm },
  message: { ...type.lead, textAlign: 'center', maxWidth: 320 },
  action: { marginTop: spacing.sm, alignSelf: 'stretch' },
});

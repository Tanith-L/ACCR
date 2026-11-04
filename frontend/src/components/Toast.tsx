// A short, gentle message under the header, clear of the buttons, e.g. after finishing a lesson.
// It is also announced to screen readers.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors, fonts, radius, shadows, spacing } from '@/theme';

import { Icon } from './Icon';

const VISIBLE_MS = 2600;
const BELOW_HEADER = 56;

const ToastContext = createContext<(message: string) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [message, setMessage] = useState<string | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback(
    (text: string) => {
      clearTimeout(timer.current);
      setMessage(text);
      AccessibilityInfo.announceForAccessibility(text);
      const fade = (toValue: number, done?: () => void) =>
        Animated.timing(opacity, { toValue, duration: reducedMotion ? 0 : 200, useNativeDriver: true }).start(done);
      fade(1);
      timer.current = setTimeout(() => fade(0, () => setMessage(null)), VISIBLE_MS);
    },
    [opacity, reducedMotion],
  );

  return (
    <ToastContext.Provider value={show}>
      <View style={styles.root}>
        {children}
        {message && (
          <Animated.View
            pointerEvents="none"
            style={[styles.toast, { opacity, top: insets.top + BELOW_HEADER }]}
          >
            <Icon name="check-circle" size={20} color={colors.primaryText} />
            <Text style={styles.text}>{message}</Text>
          </Animated.View>
        )}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '90%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadows.card,
  },
  text: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.primaryText },
});

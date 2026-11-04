import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors, radius } from '@/theme';

/** Rounded bar that eases to its new value, or jumps there when motion is reduced. */
export function ProgressBar({ value, label, trackColor }: { value: number; label: string; trackColor?: string }) {
  const ratio = Math.max(0, Math.min(1, value));
  const reducedMotion = useReducedMotion();
  const [width] = useState(() => new Animated.Value(ratio));

  useEffect(() => {
    if (reducedMotion) width.setValue(ratio);
    else Animated.timing(width, { toValue: ratio, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [ratio, reducedMotion, width]);

  return (
    <View
      style={[styles.track, trackColor ? { backgroundColor: trackColor } : null]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
    >
      <Animated.View
        style={[styles.fill, { width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
});

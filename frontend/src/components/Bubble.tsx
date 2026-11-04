import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors } from '@/theme';

import { Icon, type IconName } from './Icon';

/** Large round badge at the top of the quiz and state screens. Pops in gently unless motion is reduced. */
export function Bubble({
  icon,
  tone = 'soft',
  size = 104,
}: {
  icon: IconName;
  tone?: 'soft' | 'success' | 'gentle';
  size?: number;
}) {
  const reducedMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reducedMotion) return;
    scale.setValue(0.85);
    Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
  }, [icon, reducedMotion, scale]);

  const bg = tone === 'gentle' ? colors.accentSoft : colors.primarySoft;
  const fg = tone === 'gentle' ? colors.accentText : tone === 'success' ? colors.success : colors.primary;
  return (
    <Animated.View style={[styles.bubble, { width: size, height: size, backgroundColor: bg, transform: [{ scale }] }]}>
      <Icon name={icon} size={size * 0.42} color={fg} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});

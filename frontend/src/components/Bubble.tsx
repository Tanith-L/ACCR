import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { Icon, type IconName } from './Icon';

/** Large round badge at the top of the quiz screens ("?", ✓, ✗). */
export function Bubble({
  icon,
  tone = 'soft',
  size = 104,
}: {
  icon: IconName;
  tone?: 'soft' | 'success' | 'danger';
  size?: number;
}) {
  const bg = tone === 'danger' ? colors.danger : colors.primarySoft;
  const fg = tone === 'danger' ? colors.primaryText : tone === 'success' ? colors.success : colors.primary;
  return (
    <View style={[styles.bubble, { width: size, height: size, backgroundColor: bg }]}>
      <Icon name={icon} size={size * 0.42} color={fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});

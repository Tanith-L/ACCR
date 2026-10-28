import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

import { Icon } from './Icon';

interface Props {
  /** Label next to the back chevron, e.g. "Topics". Omit for no back button. */
  backLabel?: string;
  onBack?: () => void;
  title?: string;
}

// Opened from a link there may be nothing to go back to, so fall back to Home.
const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** "‹ Topics      Topic" row from the Figma screens. */
export function AppHeader({ backLabel, onBack = goBack, title }: Props) {
  return (
    <View style={styles.row}>
      {title ? (
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {backLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Back to ${backLabel}`}
          onPress={onBack}
          hitSlop={12}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        >
          <Icon name="chevron-left" size={22} color={colors.primary} />
          <Text style={styles.backLabel}>{backLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 44, justifyContent: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginLeft: -6 },
  backLabel: { fontFamily: fonts.medium, fontSize: 17, color: colors.primary },
  title: {
    position: 'absolute',
    left: 96,
    right: 96,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.text,
  },
});

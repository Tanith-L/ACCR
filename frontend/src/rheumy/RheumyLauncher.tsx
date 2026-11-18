// The floating Rheumy button, shown over every screen (bottom right, just above the tab
// bar) so help is one tap away anywhere in the app. It opens the chat as a sheet; closing
// the sheet keeps the conversation. Hidden on the one-time welcome screen and while the
// chat is open.
import { router, usePathname } from 'expo-router';
import { Image, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { colors, shadows, spacing } from '@/theme';

import { RHEUMY_AVATAR, RheumyChat } from './RheumyChat';
import { useRheumy } from './RheumyContext';

const SIZE = 60;

export function RheumyLauncher() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { open, setOpen, tabBarHeight, busy } = useRheumy();

  const close = () => setOpen(false);
  const openLesson = (lessonId: string) => {
    setOpen(false);
    router.push({ pathname: '/lesson/[lessonId]', params: { lessonId, back: 'Back' } });
  };

  const hidden = pathname === '/welcome';
  // Above the tab bar when there is one, otherwise above the home indicator.
  const bottom = (tabBarHeight > 0 ? tabBarHeight : insets.bottom) + spacing.md;

  return (
    <>
      {!hidden && !open ? (
        <View pointerEvents="box-none" style={[styles.anchor, { bottom, right: spacing.lg + insets.right }]}>
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Ask Rheumy, your PsA learning assistant"
            accessibilityHint="Opens a chat about what RheumNotes teaches"
            style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }] }]}
          >
            <Image source={RHEUMY_AVATAR} style={styles.avatar} accessibilityIgnoresInvertColors />
            <View style={styles.badge}>
              <Icon name={busy ? 'more-horizontal' : 'message-circle'} size={13} color={colors.primaryText} />
            </View>
          </Pressable>
        </View>
      ) : null}
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={close}
        supportedOrientations={['portrait', 'landscape']}
      >
        <RheumyChat onClose={close} onOpenLesson={openLesson} />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', zIndex: 50 },
  fab: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.primary,
    ...shadows.card,
    boxShadow: '0 4px 14px rgba(31, 42, 55, 0.22)',
  },
  avatar: { width: '100%', height: '100%', borderRadius: SIZE / 2 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});

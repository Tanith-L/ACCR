// A large "Enlarge image" button and a full-screen view, for posters whose small
// print is hard to read in the page. Pinching zooms on iOS, but is never required.
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, minTouch, spacing } from '@/theme';

import { Button } from './Button';
import { Icon } from './Icon';

export function ImageViewer({ source, altText, ratio }: { source: ImageSourcePropType; altText: string; ratio: number }) {
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Enlarge image: ${altText}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.enlarge, pressed && { opacity: 0.6 }]}
      >
        <Icon name="maximize-2" size={18} color={colors.primary} />
        <Text style={styles.enlargeText}>Enlarge image</Text>
      </Pressable>
      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md }]}>
          <ScrollView maximumZoomScale={4} minimumZoomScale={1} contentContainerStyle={styles.scroll} centerContent>
            <Image source={source} style={{ width, height: width / ratio }} resizeMode="contain" accessibilityLabel={altText} />
          </ScrollView>
          <View style={styles.close}>
            <Button label="Close" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  enlarge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: minTouch, alignSelf: 'flex-start' },
  enlargeText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.primary },
  modal: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  close: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
});

// A large "Enlarge image" button and a full-screen view, for posters whose small
// print is hard to read in the page. Pinching zooms on iOS, but is never required.
// ImageModal is the full-screen view on its own, for thumbnails that open it when tapped.
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, minTouch, spacing, type } from '@/theme';

import { Button } from './Button';
import { Icon } from './Icon';

interface ModalProps {
  source: ImageSourcePropType;
  altText: string;
  ratio: number;
  /** Shown under the image, e.g. the figure's citation. */
  credit?: string | null;
  open: boolean;
  onClose: () => void;
}

export function ImageModal({ source, altText, ratio, credit, open, onClose }: ModalProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Fit the whole image on screen, leaving room for the caption and the Close button.
  const maxH = height - insets.top - insets.bottom - 200;
  const w = Math.min(width, maxH * ratio);
  return (
    <Modal visible={open} animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={[styles.modal, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md }]}>
        <ScrollView maximumZoomScale={4} minimumZoomScale={1} contentContainerStyle={styles.scroll} centerContent>
          <Image source={source} style={{ width: w, height: w / ratio, alignSelf: 'center' }} resizeMode="contain" accessibilityLabel={altText} />
          {credit ? <Text style={styles.credit}>{credit}</Text> : null}
        </ScrollView>
        <View style={styles.close}>
          <Button label="Close" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

export function ImageViewer({ source, altText, ratio }: { source: ImageSourcePropType; altText: string; ratio: number }) {
  const [open, setOpen] = useState(false);
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
      <ImageModal source={source} altText={altText} ratio={ratio} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  enlarge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: minTouch, alignSelf: 'flex-start' },
  enlargeText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.primary },
  modal: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', gap: spacing.md },
  credit: { ...type.caption, fontSize: 13, lineHeight: 18, paddingHorizontal: spacing.xl },
  close: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
});

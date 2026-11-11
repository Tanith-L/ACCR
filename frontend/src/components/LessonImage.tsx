import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { LessonImage as LessonImageData } from '@/content';
import { resolveImage } from '@/content/media';
import { colors, radius, spacing, type } from '@/theme';

import { ImageModal, ImageViewer } from './ImageViewer';

/** Image with alt text and credit; tap it (or Enlarge image) to open it large. A placeholder box when it can't be loaded. */
export function LessonImage({ image }: { image: LessonImageData }) {
  const source = resolveImage(image.path);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(0);
  const [remoteRatio, setRemoteRatio] = useState<number>();

  // Posters vary a lot in shape. Local assets know their size up front;
  // remote ones are measured once. The explicit height matters on web,
  // where local assets otherwise keep their natural pixel height.
  const resolved = source && typeof source === 'number' ? Image.resolveAssetSource(source) : source;
  const dims = Array.isArray(resolved) ? resolved[0] : resolved;
  const knownRatio = dims?.width && dims?.height ? dims.width / dims.height : undefined;
  const uri = dims?.uri;

  useEffect(() => {
    if (knownRatio || !uri) return;
    Image.getSize(uri, (w, h) => h && setRemoteRatio(w / h), () => {});
  }, [knownRatio, uri]);

  const aspectRatio = knownRatio ?? remoteRatio ?? 4 / 3;
  return (
    <View style={styles.figure}>
      <View style={styles.panel}>
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {source && !failed ? (
            <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Enlarge image: ${image.altText}`}>
              <Image
                source={source}
                style={[styles.image, width ? { width, height: width / aspectRatio } : { aspectRatio }]}
                resizeMode="contain"
                accessibilityLabel={image.altText}
                onError={() => setFailed(true)}
              />
            </Pressable>
          ) : (
            <View style={[styles.image, styles.placeholder]} accessibilityLabel={image.altText}>
              <Text style={styles.placeholderText}>{image.altText}</Text>
            </View>
          )}
        </View>
      </View>
      {source && !failed && <ImageViewer source={source} altText={image.altText} ratio={aspectRatio} />}
      {source && !failed && (
        <ImageModal source={source} altText={image.altText} ratio={aspectRatio} credit={image.credit} open={open} onClose={() => setOpen(false)} />
      )}
      {image.credit ? <Text style={styles.credit}>{image.credit}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  figure: { gap: spacing.sm },
  // Soft framed panel, tighter on the sides so posters stay readable.
  panel: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.imagePanel },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.sm },
  placeholder: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  placeholderText: { ...type.caption, textAlign: 'center' },
  credit: { ...type.caption, fontSize: 13 },
});

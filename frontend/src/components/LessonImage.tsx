import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { LessonImage as LessonImageData } from '@/content';
import { resolveImage } from '@/content/localMedia';
import { colors, radius, spacing, type } from '@/theme';

/** Image with alt text and credit; a placeholder box when it can't be loaded. */
export function LessonImage({ image }: { image: LessonImageData }) {
  const source = resolveImage(image.file);
  const [failed, setFailed] = useState(false);
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
    <View style={styles.figure} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {source && !failed ? (
        <Image
          source={source}
          style={[styles.image, width ? { width, height: width / aspectRatio } : { aspectRatio }]}
          resizeMode="contain"
          accessibilityLabel={image.altText}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[styles.image, styles.placeholder]} accessibilityLabel={image.altText}>
          <Text style={styles.placeholderText}>Image: {image.altText}</Text>
        </View>
      )}
      {image.credit ? <Text style={styles.credit}>Credit: {image.credit}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  figure: { gap: spacing.xs },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.surface },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  placeholderText: { ...type.caption, textAlign: 'center' },
  credit: { ...type.caption, fontSize: 12 },
});

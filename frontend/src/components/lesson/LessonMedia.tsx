import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { Icon } from '@/components/Icon';
import { ImageModal } from '@/components/ImageViewer';
import { LessonVideo } from '@/components/LessonVideo';
import type { LessonImage } from '@/content';
import { resolveImage, type LessonVideoAsset } from '@/content/media';
import { colors, radius, spacing, type } from '@/theme';

const GAP = spacing.sm;
/** Share of the row the video takes; the images share the rest. */
const VIDEO_SHARE = 0.6;

/** Width / height of an image: local assets know it, remote ones are measured once. */
function useRatio(source: ImageSourcePropType): number {
  const resolved = typeof source === 'number' ? Image.resolveAssetSource(source) : source;
  const dims = Array.isArray(resolved) ? resolved[0] : resolved;
  const known = dims?.width && dims?.height ? dims.width / dims.height : undefined;
  const [measured, setMeasured] = useState<number>();
  const uri = dims?.uri;
  useEffect(() => {
    if (known || !uri) return;
    Image.getSize(uri, (w, h) => h && setMeasured(w / h), () => {});
  }, [known, uri]);
  return known ?? measured ?? 4 / 3;
}

function Thumb({ image, source, height, extra }: { image: LessonImage; source: ImageSourcePropType; height: number; extra: number }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const ratio = useRatio(source);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={failed}
        accessibilityRole="button"
        accessibilityLabel={`Enlarge image: ${image.altText}`}
        style={({ pressed }) => [styles.thumb, { height }, pressed && { opacity: 0.85 }]}
      >
        {failed ? (
          <Text style={styles.failed} numberOfLines={3}>
            {image.altText}
          </Text>
        ) : (
          <Image source={source} style={styles.thumbImage} resizeMode="cover" onError={() => setFailed(true)} />
        )}
        {!failed && (
          <View style={styles.badge}>
            <Icon name={extra > 0 ? 'plus' : 'maximize-2'} size={12} color={colors.primaryText} />
            {extra > 0 ? <Text style={styles.badgeText}>{extra}</Text> : null}
          </View>
        )}
      </Pressable>
      <ImageModal source={source} altText={image.altText} ratio={ratio} credit={image.credit} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * The lesson's video and its images side by side: the video on the left, the images
 * as thumbnails on the right, as tall as the video. Tapping either opens it large.
 * Up to two thumbnails are shown; the last one notes how many more there are.
 */
export function LessonMedia({ video, images, title }: { video: LessonVideoAsset; images: LessonImage[]; title: string }) {
  const [width, setWidth] = useState(0);
  const [showCredits, setShowCredits] = useState(false);
  const items = images.flatMap((im) => {
    const source = resolveImage(im.path);
    return source ? [{ image: im, source }] : [];
  });
  const shown = items.slice(0, 2);
  const videoW = width * VIDEO_SHARE;
  const rowH = (videoW * 9) / 16;
  const thumbH = shown.length ? (rowH - GAP * (shown.length - 1)) / shown.length : 0;
  const credits = [...new Set(items.map((i) => i.image.credit).filter((c): c is string => !!c))];

  return (
    <View style={styles.wrap}>
      <View style={styles.label}>
        <Icon name="play-circle" size={18} color={colors.primary} />
        <Text style={type.caption}>Watch the video · tap a picture to enlarge</Text>
      </View>
      <View style={styles.row} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View style={{ width: width ? videoW : `${VIDEO_SHARE * 100}%` }}>
          <LessonVideo video={video} title={title} compact />
        </View>
        <View style={styles.thumbs}>
          {width > 0 &&
            shown.map(({ image, source }, i) => (
              <Thumb
                key={image.mediaId}
                image={image}
                source={source}
                height={thumbH}
                extra={i === shown.length - 1 ? items.length - shown.length : 0}
              />
            ))}
        </View>
      </View>
      {/* Credits stay visible but short; the full text is one tap away (and under each enlarged image). */}
      {credits.length ? (
        <Pressable
          onPress={() => setShowCredits(!showCredits)}
          accessibilityRole="button"
          accessibilityLabel={showCredits ? 'Hide image credits' : 'Show all image credits'}
          style={styles.creditWrap}
        >
          <Text style={styles.credit} numberOfLines={showCredits ? undefined : 2}>
            {credits.length > 1 ? 'Images: ' : 'Image: '}
            {credits.join(' ')}
          </Text>
          <Text style={styles.creditToggle}>{showCredits ? 'Hide credits' : 'Show all credits'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', gap: GAP },
  thumbs: { flex: 1, gap: GAP },
  thumb: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.imagePanel, justifyContent: 'center' },
  thumbImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  failed: { ...type.caption, fontSize: 12, lineHeight: 16, padding: spacing.xs, textAlign: 'center' },
  badge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(35, 46, 39, 0.72)',
  },
  badgeText: { ...type.caption, fontSize: 12, lineHeight: 14, color: colors.primaryText, fontWeight: '600' },
  creditWrap: { gap: 2 },
  credit: { ...type.caption, fontSize: 12, lineHeight: 16 },
  creditToggle: { ...type.caption, fontSize: 12, lineHeight: 16, color: colors.primary, fontWeight: '600' },
});

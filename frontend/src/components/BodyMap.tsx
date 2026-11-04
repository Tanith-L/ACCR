// Symptoms by body area: the supplied posters of a woman and a man, where both
// the cards and the body parts on the figure open the matching lesson. The choice
// of poster is only a view on this screen; it is never stored or sent.
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import type { TopicImageMap } from '@/content';
import { resolveImage } from '@/content/media';
import { colors, fonts, minTouch, radius, spacing, type } from '@/theme';

import { Icon } from './Icon';
import { ImageViewer } from './ImageViewer';
import { MAN_POSTER, WOMAN_BODY_PARTS, WOMAN_SHA256, type PixelBox } from './posterRegions';

/** A place on a poster, as fractions of its size. */
type Box = { x: number; y: number; width: number; height: number };

interface PosterLink {
  key: string;
  label: string;
  lessonId: string;
  box: Box;
}

interface PosterData {
  source: ImageSourcePropType;
  altText: string;
  credit: string | null;
  ratio: number;
  cards: PosterLink[];
  bodyParts: PosterLink[];
}

const fraction = ([x1, y1, x2, y2]: PixelBox, width: number, height: number): Box => ({
  x: x1 / width,
  y: y1 / height,
  width: (x2 - x1) / width,
  height: (y2 - y1) / height,
});

const percentOf = (box: Box) => ({
  left: `${box.x * 100}%` as const,
  top: `${box.y * 100}%` as const,
  width: `${box.width * 100}%` as const,
  height: `${box.height * 100}%` as const,
});

/** Links for the body parts whose hotspot is in the map, so unpublished lessons stay out. */
function bodyLinks(prefix: string, map: TopicImageMap, parts: Record<string, PixelBox[]>, width: number, height: number) {
  return map.hotspots.flatMap((h) =>
    (parts[h.id] ?? []).map((box, i) => ({
      key: `${prefix}-${h.id}-${i}`,
      label: h.label,
      lessonId: h.lessonId,
      box: fraction(box, width, height),
    })),
  );
}

function womanPoster(map: TopicImageMap): PosterData | null {
  const source = resolveImage(map.image.path);
  if (!source) return null;
  return {
    source,
    altText: map.image.altText,
    credit: map.image.credit,
    ratio: map.imageWidth / map.imageHeight,
    cards: map.hotspots.map((h) => ({ key: h.id, label: h.label, lessonId: h.lessonId, box: h.bounds })),
    // A replaced poster has different coordinates, so it falls back to its cards.
    bodyParts: map.imageSha256 === WOMAN_SHA256 ? bodyLinks('woman', map, WOMAN_BODY_PARTS, map.imageWidth, map.imageHeight) : [],
  };
}

function manPoster(map: TopicImageMap): PosterData | null {
  const source = resolveImage(MAN_POSTER.path);
  if (!source) return null;
  const { width, height } = MAN_POSTER;
  return {
    source,
    altText: MAN_POSTER.altText,
    credit: MAN_POSTER.credit,
    ratio: width / height,
    cards: MAN_POSTER.cards.flatMap((card) => {
      const hotspot = map.hotspots.find((h) => h.id === card.hotspot);
      return hotspot
        ? [{ key: card.label, label: card.label, lessonId: hotspot.lessonId, box: fraction(card.box, width, height) }]
        : [];
    }),
    bodyParts: bodyLinks('man', map, MAN_POSTER.bodyParts, width, height),
  };
}

interface Props {
  map: TopicImageMap;
  isCompleted: (lessonId: string) => boolean;
  onOpenLesson: (lessonId: string) => void;
}

export function BodyMap({ map, isCompleted, onOpenLesson }: Props) {
  const [view, setView] = useState<'woman' | 'man'>('woman');
  const [width, setWidth] = useState(0);

  const posters = { woman: womanPoster(map), man: manPoster(map) };
  const poster = posters[view] ?? posters.woman ?? posters.man;
  if (!poster) return null;
  const canSwitch = !!posters.woman && !!posters.man;

  return (
    <View style={styles.root}>
      <Text style={type.heading}>Explore by body area</Text>
      <Text style={type.caption}>
        Tap a body part or a card to read about it. A body map cannot tell you the cause of a symptom.
      </Text>

      {canSwitch && (
        <View style={styles.tabs}>
          {(['woman', 'man'] as const).map((id) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`Show the ${id}`}
              accessibilityState={{ selected: view === id }}
              onPress={() => setView(id)}
              style={[styles.tab, view === id && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, view === id && styles.tabLabelActive]}>{id === 'woman' ? 'Woman' : 'Man'}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <View style={{ width, height: width / poster.ratio }}>
            <Image source={poster.source} style={styles.poster} resizeMode="contain" accessibilityLabel={poster.altText} />

            {/* The cards carry the labels for screen readers; the body parts repeat the same links. */}
            {poster.bodyParts.map((part) => (
              <Pressable
                key={part.key}
                testID={part.key}
                accessibilityElementsHidden
                importantForAccessibility="no"
                onPress={() => onOpenLesson(part.lessonId)}
                style={({ pressed }) => [styles.bodyPart, pressed && styles.bodyPartPressed, percentOf(part.box)]}
              >
                <View style={[styles.marker, isCompleted(part.lessonId) && styles.markerDone]}>
                  {isCompleted(part.lessonId) && <Icon name="check" size={10} color={colors.primaryText} />}
                </View>
              </Pressable>
            ))}

            {poster.cards.map((card) => (
              <Pressable
                key={card.key}
                accessibilityRole="button"
                accessibilityLabel={isCompleted(card.lessonId) ? `${card.label}, completed` : card.label}
                onPress={() => onOpenLesson(card.lessonId)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed, percentOf(card.box)]}
              />
            ))}
          </View>
        )}
      </View>

      <ImageViewer source={poster.source} altText={poster.altText} ratio={poster.ratio} />
      {poster.credit ? <Text style={styles.credit}>{poster.credit}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  tabs: { flexDirection: 'row', gap: spacing.xs, padding: spacing.xs, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  tab: { flex: 1, minHeight: minTouch, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm - 4 },
  tabActive: { backgroundColor: colors.surface },
  tabLabel: { fontFamily: fonts.medium, fontSize: 16, color: colors.primary },
  tabLabelActive: { fontFamily: fonts.semibold, color: colors.text },
  poster: { width: '100%', height: '100%', borderRadius: radius.sm },
  card: { position: 'absolute', borderRadius: radius.sm - 4, borderWidth: 1.5, borderColor: colors.primary },
  cardPressed: { backgroundColor: colors.primary, opacity: 0.25 },
  bodyPart: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm - 4 },
  bodyPartPressed: { backgroundColor: colors.primary, opacity: 0.35 },
  marker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
  },
  markerDone: { backgroundColor: colors.success },
  credit: { ...type.caption, fontSize: 13 },
});

import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LessonVideoAsset } from '@/content/media';
import { colors, radius, spacing, type } from '@/theme';

import { Button } from './Button';
import { Icon } from './Icon';

interface Props {
  video: LessonVideoAsset;
  title: string;
  /** In the media row next to images: no label above, a smaller Play button. */
  compact?: boolean;
}

/**
 * The lesson's whiteboard video. In the page it shows its cover (the title frame);
 * tapping it opens a large player that starts playing, with the usual controls
 * (rotate the phone or use the player's full-screen button for bigger still).
 * Closing pauses it. It never autoplays on its own.
 * Captions are embedded in the file and switched on when the player finds them.
 * If the file can't load, the player says so and offers to try again.
 */
export function LessonVideo({ video, title, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const player = useVideoPlayer(video.source, (p) => {
    p.loop = false;
    p.addListener('statusChange', ({ status }) => setFailed(status === 'error'));
    p.addListener('availableSubtitleTracksChange', ({ availableSubtitleTracks }) => {
      if (availableSubtitleTracks.length > 0 && !p.subtitleTrack) p.subtitleTrack = availableSubtitleTracks[0];
    });
  });
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // As wide as the screen, or as tall as it allows when the phone is turned sideways.
  const playerW = Math.min(width, (height - insets.top - insets.bottom - 120) * (16 / 9));

  const playerH = (playerW * 9) / 16;

  // Start once the large player is on screen (the web player ignores play() before that).
  useEffect(() => {
    if (open) player.play();
  }, [open, player]);

  const show = () => setOpen(true);
  const close = () => {
    player.pause();
    setOpen(false);
  };
  const retry = () => {
    setFailed(false);
    player.replace(video.source);
    player.play();
  };

  return (
    <View style={styles.figure}>
      {!compact && (
        <View style={styles.label}>
          <Icon name="play-circle" size={18} color={colors.primary} />
          <Text style={type.caption}>Watch the video</Text>
        </View>
      )}
      <Pressable
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel={`Play video: ${title}, about ${video.minutes} minutes. Opens a larger player.`}
        style={({ pressed }) => [styles.frame, pressed && { opacity: 0.85 }]}
      >
        <Image source={video.cover} style={styles.cover} resizeMode="cover" />
        <View style={[styles.playButton, compact && styles.playButtonCompact]}>
          <Icon name="play" size={compact ? 14 : 18} color={colors.primaryText} />
          <Text style={[styles.playText, compact && { fontSize: 13 }]}>Play</Text>
        </View>
      </Pressable>

      <Modal visible={open} animationType="fade" onRequestClose={close} supportedOrientations={['portrait', 'landscape']}>
        <View style={[styles.modal, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md }]}>
          <Text style={styles.modalTitle} numberOfLines={2} accessibilityRole="header">
            {title}
          </Text>
          <View style={[styles.player, { width: playerW, height: playerH }]}>
            <VideoView
              player={player}
              style={{ width: playerW, height: playerH }}
              nativeControls
              contentFit="contain"
              fullscreenOptions={{ enable: true }}
              accessibilityLabel={`Video: ${title}`}
            />
            {failed ? (
              <View style={styles.error} accessibilityRole="alert">
                <Icon name="video-off" size={28} color={colors.textMuted} />
                <Text style={styles.errorText}>This video can’t play right now.</Text>
                <Pressable onPress={retry} accessibilityRole="button" hitSlop={8} style={({ pressed }) => [styles.retry, pressed && { opacity: 0.6 }]}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          <View style={styles.close}>
            <Button label="Close" onPress={close} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  figure: { gap: spacing.sm },
  label: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.imagePanel,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  cover: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    margin: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  playButtonCompact: { margin: spacing.sm, paddingVertical: 5, paddingHorizontal: spacing.sm },
  playText: { ...type.caption, color: colors.primaryText, fontWeight: '600' },
  modal: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.background },
  modalTitle: { ...type.heading, textAlign: 'center', paddingHorizontal: spacing.xl },
  player: { backgroundColor: '#000', overflow: 'hidden' },
  error: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    backgroundColor: colors.imagePanel,
  },
  errorText: { ...type.caption, color: colors.text, textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  retryText: { ...type.caption, color: colors.primary, fontWeight: '600' },
  close: { alignSelf: 'stretch', paddingHorizontal: spacing.xl },
});

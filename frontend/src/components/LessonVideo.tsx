import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LessonVideoAsset } from '@/content/media';
import { colors, minTouch, radius, spacing, type } from '@/theme';

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
 * Subtitles are drawn into the video picture itself, so they show on every platform and in
 * full screen with nothing to switch on. (The file's caption track is left off so they don't show twice.)
 * If the file can't load, the player says so and offers to try again.
 * When the lesson has voice samples (content/voiceDemo.ts), the player shows a switch between
 * the candidate narration voices; switching starts the video again in that voice.
 */
export function LessonVideo({ video, title, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const voices = video.voices ?? [];
  const [voiceId, setVoiceId] = useState(voices[0]?.voice.id);
  const current = voices.find((v) => v.voice.id === voiceId) ?? voices[0];
  const source = current?.source ?? video.source;
  const player = useVideoPlayer(video.source, (p) => {
    p.loop = false;
    p.addListener('statusChange', ({ status }) => setFailed(status === 'error'));
  });
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // As wide as the screen, or as tall as the room left for it: the title bar and Close button
  // (about 140 points) and, when the voice switch is shown, its label, buttons and note.
  const reserved = 140 + (voices.length > 1 ? VOICE_SWITCH_HEIGHT : 0);
  const playerW = Math.max(160, Math.min(width, (height - insets.top - insets.bottom - reserved) * (16 / 9)));

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
    player.replace(source);
    player.play();
  };
  const chooseVoice = async (id: string) => {
    const next = voices.find((v) => v.voice.id === id);
    if (!next || id === current?.voice.id) return;
    setVoiceId(id);
    setFailed(false);
    await player.replaceAsync(next.source);
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
        {voices.length > 1 ? (
          <View style={styles.voiceBadge}>
            <Icon name="mic" size={12} color={colors.primaryText} />
            <Text style={styles.voiceBadgeText}>{voices.length} voices</Text>
          </View>
        ) : null}
        <View style={[styles.playButton, compact && styles.playButtonCompact]}>
          <Icon name="play" size={compact ? 14 : 18} color={colors.primaryText} />
          <Text style={[styles.playText, compact && { fontSize: 13 }]}>Play</Text>
        </View>
      </Pressable>

      <Modal visible={open} animationType="fade" onRequestClose={close} supportedOrientations={['portrait', 'landscape']}>
        <View style={[styles.modalRoot, { paddingTop: insets.top + spacing.sm }]}>
          {/* Title with a close button that is always on screen, whatever fits below. */}
          <View style={styles.topBar}>
            <Text style={styles.modalTitle} numberOfLines={2} accessibilityRole="header">
              {title}
            </Text>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close video"
              hitSlop={8}
              style={({ pressed }) => [styles.closeIcon, pressed && { opacity: 0.6 }]}
            >
              <Icon name="x" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.modal, { paddingBottom: insets.bottom + spacing.md }]}
          >
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
          {voices.length > 1 && current ? (
            <View style={styles.voices}>
              <Text style={styles.voicesLabel}>Narration voice</Text>
              <View style={styles.voiceRow} accessibilityRole="radiogroup">
                {voices.map(({ voice }) => {
                  const on = voice.id === current.voice.id;
                  return (
                    <Pressable
                      key={voice.id}
                      onPress={() => chooseVoice(voice.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${voice.label} voice. ${voice.description}`}
                      style={({ pressed }) => [styles.voiceButton, on && styles.voiceButtonOn, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={[styles.voiceText, on && styles.voiceTextOn]}>{voice.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.voiceNote}>{current.voice.description}</Text>
            </View>
          ) : null}
          <View style={styles.close}>
            <Button label="Close" onPress={close} />
          </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

/** Height of the voice switch: label, up to two rows of buttons and the one-line note. */
const VOICE_SWITCH_HEIGHT = 170;

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
  modal: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, paddingTop: spacing.sm },
  modalRoot: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  modalTitle: { ...type.heading, flex: 1 },
  closeIcon: {
    width: minTouch,
    height: minTouch,
    borderRadius: minTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.imagePanel,
  },
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
  voiceBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(35, 46, 39, 0.72)',
  },
  voiceBadgeText: { ...type.caption, fontSize: 12, lineHeight: 16, color: colors.primaryText, fontWeight: '600' },
  voices: { alignSelf: 'stretch', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg },
  voicesLabel: { ...type.caption, fontWeight: '600', color: colors.text },
  voiceRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  voiceButton: {
    minHeight: minTouch,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  voiceButtonOn: { backgroundColor: colors.primary },
  voiceText: { ...type.caption, color: colors.primary, fontWeight: '600' },
  voiceTextOn: { color: colors.primaryText },
  voiceNote: { ...type.caption, fontSize: 13, lineHeight: 18, textAlign: 'center' },
});

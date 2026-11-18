// The Rheumy chat sheet: answers from the RheumNotes lessons and their source documents
// (rheumy-chat Edge Function), citations that open the lesson, and answers read aloud
// (rheumy-tts, Azure voices Ava, Jenny, Emma). Opened from the floating button on every
// screen (RheumyLauncher). Demo only: the content is not yet clinically reviewed, nothing
// is saved, and people are asked not to type personal details. See docs/rheumy-chatbot.md.
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Markdown } from '@/components/Markdown';
import { colors, fonts, minTouch, radius, spacing, type } from '@/theme';

import { rheumyConfig, speechUrl, VOICES, type RheumyCitation } from './client';
import { useRheumy, type RheumyMessage } from './RheumyContext';

export const RHEUMY_AVATAR = require('../../assets/rheumy-avatar.jpg');
const MAX_CHARS = 600;
const SUGGESTIONS = [
  'What is psoriatic arthritis?',
  'Why can PsA cause heel pain?',
  'Which eye symptoms need prompt care?',
  'How can I get ready for a doctor visit?',
  'What helps with sleep and tiredness?',
];

function Citations({ items, onOpenLesson }: { items: RheumyCitation[]; onOpenLesson: (lessonId: string) => void }) {
  if (!items.length) return null;
  return (
    <View style={styles.cites}>
      <Text style={styles.citesTitle}>Where this comes from</Text>
      {items.map((c) =>
        c.kind === 'lesson' ? (
          <Pressable
            key={c.n}
            onPress={() => onOpenLesson(c.sourceId)}
            accessibilityRole="link"
            accessibilityLabel={`Source ${c.n}: lesson ${c.title}. Opens the lesson.`}
            style={({ pressed }) => [styles.cite, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.citeText}>
              [{c.n}] Lesson: <Text style={styles.citeLink}>{c.title}</Text>
              {c.locator ? ` · ${c.locator}` : ''}
            </Text>
          </Pressable>
        ) : (
          <View key={c.n} style={styles.cite}>
            <Text style={styles.citeText}>
              [{c.n}] Source document: {c.title} (written for clinicians)
            </Text>
          </View>
        ),
      )}
    </View>
  );
}

export function RheumyChat({ onClose, onOpenLesson }: { onClose: () => void; onOpenLesson: (lessonId: string) => void }) {
  const insets = useSafeAreaInsets();
  const { messages, busy, voice, setVoice, send, clear } = useRheumy();
  const [draft, setDraft] = useState('');
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance | null>(null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  // The answer being read aloud; none once playback has finished.
  const speakingId = status.didJustFinish ? null : speaking;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const submit = (text: string) => {
    if (!text.trim() || busy) return;
    send(text);
    setDraft('');
  };

  const listen = (m: RheumyMessage) => {
    setAudioError(null);
    if (speakingId === m.id) {
      player.pause();
      setSpeaking(null);
      return;
    }
    const uri = speechUrl(m.text, voice);
    if (!uri) return;
    try {
      player.replace({ uri });
      player.play();
      setSpeaking(m.id);
    } catch {
      setAudioError('The answer can’t be read aloud right now.');
      setSpeaking(null);
    }
  };

  const clearChat = () => {
    player.pause();
    setSpeaking(null);
    clear();
  };

  const header = (
    <View style={[styles.header, { paddingTop: (Platform.OS === 'ios' ? spacing.md : insets.top) + spacing.sm }]}>
      <Image source={RHEUMY_AVATAR} style={styles.avatar} accessibilityIgnoresInvertColors accessibilityLabel="Rheumy" />
      <View style={{ flex: 1 }}>
        <Text style={type.heading} accessibilityRole="header">
          Rheumy
        </Text>
        <Text style={styles.subtitle}>Your PsA learning assistant · demo</Text>
      </View>
      {messages.length > 0 ? (
        <Pressable onPress={clearChat} accessibilityRole="button" hitSlop={8} style={styles.headerButton}>
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close Rheumy"
        hitSlop={8}
        style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
      >
        <Icon name="x" size={22} color={colors.text} />
      </Pressable>
    </View>
  );

  if (!rheumyConfig.ok) {
    return (
      <View style={styles.root}>
        {header}
        <View style={[styles.notice, styles.setup]} accessibilityRole="alert">
          <Text style={styles.noticeTitle}>Rheumy isn’t set up in this build</Text>
          <Text style={styles.noticeText}>
            {rheumyConfig.problem ??
              `Add ${rheumyConfig.missing.join(' and ')} to frontend/.env.local, then restart the app. See docs/rheumy-chatbot.md.`}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={styles.thread}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Demo: answers come from the RheumNotes lessons and their sources, which are{' '}
            <Text style={styles.bold}>not yet reviewed by a clinician</Text>. Rheumy can’t give medical advice. Please don’t type
            your name or other personal details. In an emergency, call 911.
          </Text>
        </View>

        <View style={[styles.bubble, styles.assistant]}>
          <Text style={styles.bubbleText}>
            Hi, I’m Rheumy. I can explain what RheumNotes teaches about psoriatic arthritis. What would you like to know?
          </Text>
        </View>
        {messages.length === 0 ? (
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => submit(s)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: colors.primarySoft }]}
              >
                <Text style={styles.suggestionText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {messages.map((m) =>
          m.role === 'user' ? (
            <View key={m.id} style={[styles.bubble, styles.user]}>
              <Text style={[styles.bubbleText, { color: colors.primaryText }]}>{m.text}</Text>
            </View>
          ) : (
            <View key={m.id} style={[styles.bubble, styles.assistant, m.error && styles.errorBubble]}>
              {m.error ? <Text style={styles.bubbleText}>{m.text}</Text> : <Markdown source={m.text} />}
              {m.answer?.notice ? (
                <View style={styles.urgent} accessibilityRole="alert">
                  <Icon name="alert-triangle" size={16} color={colors.accentText} />
                  <Text style={styles.urgentText}>{m.answer.notice}</Text>
                </View>
              ) : null}
              {m.answer ? <Citations items={m.answer.citations} onOpenLesson={onOpenLesson} /> : null}
              {m.answer && m.answer.urgency !== 'emergency' ? (
                <Pressable
                  onPress={() => listen(m)}
                  accessibilityRole="button"
                  accessibilityLabel={speakingId === m.id ? 'Stop reading aloud' : `Read this answer aloud with ${voice}`}
                  style={({ pressed }) => [styles.listen, pressed && { opacity: 0.6 }]}
                >
                  <Icon name={speakingId === m.id ? 'pause' : 'volume-2'} size={16} color={colors.primary} />
                  <Text style={styles.listenText}>
                    {speakingId === m.id ? (status.playing ? 'Stop' : 'Loading…') : 'Listen'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ),
        )}
        {busy ? (
          <View style={[styles.bubble, styles.assistant, styles.thinking]}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.subtitle}>Rheumy is looking through the lessons…</Text>
          </View>
        ) : null}
        {audioError ? <Text style={[styles.subtitle, { color: colors.danger }]}>{audioError}</Text> : null}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <View style={styles.voiceRow} accessibilityRole="radiogroup" accessibilityLabel="Voice for reading answers aloud">
          <Text style={styles.voiceLabel}>Voice</Text>
          {VOICES.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => setVoice(v.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: voice === v.id }}
              style={[styles.voice, voice === v.id && styles.voiceOn]}
            >
              <Text style={[styles.voiceText, voice === v.id && { color: colors.primaryText }]}>{v.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about PsA (no personal details)"
            placeholderTextColor={colors.textMuted}
            maxLength={MAX_CHARS}
            multiline
            style={styles.input}
            accessibilityLabel="Your question for Rheumy"
            onSubmitEditing={() => submit(draft)}
            blurOnSubmit
            returnKeyType="send"
          />
          <Pressable
            onPress={() => submit(draft)}
            disabled={busy || !draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send question"
            style={({ pressed }) => [
              styles.send,
              (busy || !draft.trim()) && { backgroundColor: colors.primaryDisabled },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Icon name="send" size={20} color={colors.primaryText} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface },
  subtitle: { ...type.caption, fontSize: 13, lineHeight: 18 },
  headerButton: { minHeight: minTouch, justifyContent: 'center' },
  clearText: { ...type.caption, color: colors.primary, fontFamily: fonts.semibold },
  close: { width: minTouch, height: minTouch, borderRadius: minTouch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.imagePanel },
  thread: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.md },
  notice: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  setup: { marginHorizontal: spacing.xl, marginTop: spacing.lg },
  noticeTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.accentText },
  noticeText: { ...type.caption, fontSize: 14, lineHeight: 20, color: colors.text },
  bold: { fontFamily: fonts.semibold },
  bubble: { borderRadius: radius.lg, padding: spacing.md, maxWidth: '92%', gap: spacing.sm },
  assistant: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  user: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  errorBubble: { borderColor: colors.danger },
  bubbleText: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.text },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  suggestions: { gap: spacing.sm },
  suggestion: {
    alignSelf: 'flex-start',
    minHeight: minTouch,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  suggestionText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primary },
  urgent: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: spacing.sm },
  urgentText: { flex: 1, ...type.caption, fontSize: 14, lineHeight: 20, color: colors.accentText },
  cites: { gap: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  citesTitle: { ...type.caption, fontSize: 13, fontFamily: fonts.semibold },
  cite: { minHeight: 32, justifyContent: 'center' },
  citeText: { ...type.caption, fontSize: 13, lineHeight: 18 },
  citeLink: { color: colors.primary, textDecorationLine: 'underline' },
  listen: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: minTouch, alignSelf: 'flex-start' },
  listenText: { ...type.caption, color: colors.primary, fontFamily: fonts.semibold },
  composer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  voiceLabel: { ...type.caption, fontSize: 13, marginRight: spacing.xs },
  voice: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.primary },
  voiceOn: { backgroundColor: colors.primary },
  voiceText: { ...type.caption, fontSize: 13, color: colors.primary, fontFamily: fonts.semibold },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: minTouch,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  send: {
    width: minTouch + 4,
    height: minTouch + 4,
    borderRadius: (minTouch + 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
});

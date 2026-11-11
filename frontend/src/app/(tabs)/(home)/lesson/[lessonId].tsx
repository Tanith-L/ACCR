// Lesson: one continuous reading flow (api-contract §3.3 data, shown top to bottom):
// title and what the lesson holds, the video (side by side with the lesson's images when it
// has any), the pages' text as one continuous text, the key takeaways, then completing and
// moving on. Without a video, images follow their page's text. Tapping media opens it large.
// The content keeps text, images (tagged by page) and the lesson video separate, so
// images follow their page's text and the whole-lesson video comes first.
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { KeyTakeaways } from '@/components/lesson/KeyTakeaways';
import { LessonActions, type UpNext } from '@/components/lesson/LessonActions';
import { LessonIntro } from '@/components/lesson/LessonIntro';
import { LessonMedia } from '@/components/lesson/LessonMedia';
import { LessonSection } from '@/components/lesson/LessonSection';
import { LessonVideo } from '@/components/LessonVideo';
import { SourceLine } from '@/components/Logo';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { AsyncContent } from '@/components/StateViews';
import { useToast } from '@/components/Toast';
import { contentService, type Lesson } from '@/content';
import { hasQuiz } from '@/content/course';
import { resolveImage, resolveVideo } from '@/content/media';
import { useAsync } from '@/hooks/useAsync';
import { usePreferences } from '@/preferences/PreferencesContext';
import { readingPosition } from '@/progress/readingPosition';
import { useProgress } from '@/progress/ProgressContext';
import { spacing } from '@/theme';

type Params = {
  lessonId: string;
  /** From the topic screen; v_lessons doesn't return the topic. */
  topicId?: string;
  topicName?: string;
  /** Label for the back button: "Topic", "Lesson 1", "Quiz", "Map". */
  back?: string;
  /** The page (`LessonPage.order`) to open at, from the knowledge map. */
  page?: string;
};

interface PathInfo {
  lessonIds: string[];
  titles: Record<string, string>;
}

export default function LessonScreen() {
  const params = useLocalSearchParams<Params>();
  const { lessonId, topicId } = params;
  const { quizzesEnabled } = usePreferences();
  const state = useAsync(async () => {
    const [lesson, path] = await Promise.all([
      contentService.getLesson(lessonId),
      // The path is only for "Lesson 1 of 2" and "Up next"; the lesson still shows if it fails.
      topicId ? contentService.getLearningPath(topicId).catch(() => null) : null,
    ]);
    const info: PathInfo = {
      lessonIds: path?.lessonIds ?? [],
      titles: Object.fromEntries((path?.subtopics ?? []).flatMap((s) => s.lessons.map((l) => [l.id, l.title]))),
    };
    // Asked only on a topic's last lesson, where the quiz follows.
    const quizNext = quizzesEnabled && info.lessonIds.at(-1) === lessonId && (await hasQuiz(contentService, info.lessonIds));
    return { lesson, path: info, quizNext };
  }, `${lessonId}/${topicId}/${quizzesEnabled}`);

  const position = state.data?.path.lessonIds.indexOf(lessonId) ?? -1;
  const total = state.data?.path.lessonIds.length ?? 0;
  const positionLabel = position >= 0 ? `Lesson ${position + 1} of ${total}` : 'Lesson';
  const backLabel = params.back ?? 'Topic';

  return (
    <AsyncContent
      state={state}
      header={<AppHeader backLabel={backLabel} title={positionLabel} />}
      isEmpty={(d) => d.lesson === null}
      empty={{
        title: 'This lesson isn’t available',
        message: 'It may have been updated or removed. Go back and choose another lesson.',
      }}
    >
      {({ lesson, path, quizNext }) =>
        lesson && (
          // Keyed so the view resets when a refresh brings a new version.
          <LessonView
            key={`${lesson.id}@${lesson.version}`}
            lesson={lesson}
            path={path}
            quizNext={quizNext}
            params={params}
            positionLabel={positionLabel}
            backLabel={backLabel}
            onRefresh={state.reload}
          />
        )
      }
    </AsyncContent>
  );
}

interface ViewProps {
  lesson: Lesson;
  path: PathInfo;
  quizNext: boolean;
  params: Params;
  positionLabel: string;
  backLabel: string;
  onRefresh: () => void;
}

function LessonView({ lesson, path, quizNext, params, positionLabel, backLabel, onRefresh }: ViewProps) {
  const { isCompleted, setCompleted } = useProgress();
  const showToast = useToast();
  const { topicId, topicName } = params;
  const positionKey = `${lesson.id}@${lesson.version}`;

  const scrollRef = useRef<ScrollViewInstance>(null);
  const [progress, setProgress] = useState(0);
  const [titleBottom, setTitleBottom] = useState(Infinity);
  const [scrollY, setScrollY] = useState(0);
  const sectionY = useRef<Record<number, number>>({});
  const sectionsTop = useRef<number | null>(null);
  // Open at the knowledge map's page, else where the patient stopped reading, else the top.
  const pendingPage = useRef(params.page ? Number(params.page) : null);
  const pendingY = useRef(params.page ? 0 : readingPosition.get(positionKey));

  const video = resolveVideo(lesson.id);
  // Images whose file is missing are left out rather than shown as empty boxes.
  const images = lesson.images.filter((im) => resolveImage(im.path) !== null);
  // With a video, the images sit beside it at the top; without one, after their page's text.
  const mediaRow = !!video && images.length > 0;
  const finished = isCompleted(lesson.id);
  const index = path.lessonIds.indexOf(lesson.id);
  const nextId = index >= 0 ? path.lessonIds[index + 1] : undefined;

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const y = contentOffset.y;
      const scrollable = contentSize.height - layoutMeasurement.height;
      setScrollY(y);
      setProgress(scrollable > 0 ? y / scrollable : 1);
      readingPosition.set(positionKey, y);
    },
    [positionKey],
  );

  const scrollTo = (y: number) => scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: false });

  // Restoring needs the content to be tall enough, so it waits for the layout.
  const onContentSizeChange = (_: number, height: number) => {
    if (pendingY.current > 0 && height > pendingY.current) {
      scrollTo(pendingY.current);
      pendingY.current = 0;
    }
  };

  // A knowledge-map link opens at its page once both the section and its container are laid out.
  // The container sits in the Screen body, which starts spacing.md below the scroll top.
  const openPendingPage = () => {
    const order = pendingPage.current;
    if (order === null || sectionsTop.current === null || sectionY.current[order] === undefined) return;
    pendingPage.current = null;
    scrollTo(spacing.md + sectionsTop.current + sectionY.current[order] - spacing.sm);
  };
  const onSectionsLayout = (e: LayoutChangeEvent) => {
    sectionsTop.current = e.nativeEvent.layout.y;
    openPendingPage();
  };
  const onSectionLayout = (order: number) => (e: LayoutChangeEvent) => {
    sectionY.current[order] = e.nativeEvent.layout.y;
    openPendingPage();
  };

  const complete = () => {
    setCompleted({ id: lesson.id, topicId: topicId ?? '' }, true);
    showToast('Lesson finished. Nice work!');
  };
  const undo = () => setCompleted({ id: lesson.id, topicId: topicId ?? '' }, false);
  const toTopic = () =>
    topicId ? router.dismissTo({ pathname: '/topic/[topicId]', params: { topicId, name: topicName } }) : router.back();

  const upNext: UpNext = nextId
    ? {
        kind: 'lesson',
        title: path.titles[nextId] ?? 'Next lesson',
        onPress: () =>
          router.push({
            pathname: '/lesson/[lessonId]',
            params: { lessonId: nextId, topicId, topicName, back: `Lesson ${index + 1}` },
          }),
      }
    : quizNext && topicId
      ? { kind: 'quiz', onPress: () => router.push({ pathname: '/quiz/[topicId]', params: { topicId, topicName } }) }
      : { kind: 'topic', onPress: toTopic };

  // iOS-style: the header shows the lesson's place until the big title scrolls away, then the title.
  const header = (
    <View style={styles.header}>
      <AppHeader backLabel={backLabel} title={scrollY > titleBottom ? lesson.title : positionLabel} />
      <ProgressBar value={progress} height={4} label={`Read ${Math.round(progress * 100)}% of this lesson`} />
    </View>
  );

  return (
    <Screen
      header={header}
      onRefresh={onRefresh}
      onScroll={onScroll}
      onContentSizeChange={onContentSizeChange}
      scrollRef={scrollRef}
      actions={<LessonActions finished={finished} onComplete={complete} onUndo={undo} upNext={upNext} />}
    >
      <LessonIntro
        title={lesson.title}
        topicName={topicName}
        estMinutes={lesson.estMinutes}
        videoMinutes={video?.minutes}
        finished={finished}
        onTitleLayout={setTitleBottom}
      />

      {mediaRow && video ? (
        <LessonMedia video={video} images={images} title={lesson.title} />
      ) : video ? (
        <LessonVideo video={video} title={lesson.title} />
      ) : null}

      <View style={styles.sections} onLayout={onSectionsLayout}>
        {lesson.pages.map((page) => (
          <LessonSection
            key={page.order}
            page={page}
            images={mediaRow ? [] : images.filter((im) => im.page === page.order)}
            onLayout={onSectionLayout(page.order)}
          />
        ))}
      </View>

      <KeyTakeaways items={lesson.keyTakeaways} />
      <SourceLine />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, paddingBottom: spacing.xs },
  // Same spacing as between paragraphs, so the pages read as one text.
  sections: { gap: spacing.md },
});

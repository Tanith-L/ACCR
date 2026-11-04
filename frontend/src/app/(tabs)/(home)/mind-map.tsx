// Knowledge map: how PsA fits together, explored on one screen with no scrolling.
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { MindMap } from '@/components/MindMap';
import { AsyncContent } from '@/components/StateViews';
import { contentService } from '@/content';
import { getCourse } from '@/content/course';
import { buildKnowledgeMap } from '@/content/knowledgeMap';
import { useAsync } from '@/hooks/useAsync';
import { useProgress } from '@/progress/ProgressContext';
import { colors, spacing, type } from '@/theme';

export default function MindMapScreen() {
  const insets = useSafeAreaInsets();
  const state = useAsync(async () => buildKnowledgeMap(await getCourse(contentService)), 'mind-map');
  const { isCompleted, countCompleted } = useProgress();
  const [openPath, setOpenPath] = useState<string[]>([]);
  const header = <AppHeader backLabel="Home" title="Knowledge map" />;

  return (
    <AsyncContent
      state={state}
      header={header}
      isEmpty={(root) => root === null}
      empty={{ title: 'No lessons yet', message: 'New lessons will appear here soon.' }}
    >
      {(root) =>
        root && (
          <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
            <View style={styles.header}>{header}</View>
            <Text style={styles.hint}>
              {openPath.length ? 'Tap to explore. Tap the middle to go back.' : 'Tap a part to see how PsA fits together.'}
            </Text>
            <MindMap
              root={root}
              openPath={openPath}
              onChangePath={setOpenPath}
              isCompleted={isCompleted}
              countCompleted={countCompleted}
              onOpenLesson={({ lesson }) =>
                lesson &&
                router.push({
                  pathname: '/lesson/[lessonId]',
                  params: {
                    lessonId: lesson.id,
                    topicId: lesson.topicId,
                    topicName: lesson.topicName,
                    back: 'Map',
                    ...(lesson.page ? { page: String(lesson.page) } : {}),
                  },
                })
              }
            />
          </View>
        )
      }
    </AsyncContent>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.sm, paddingBottom: spacing.md, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.sm },
  hint: { ...type.lead, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
});

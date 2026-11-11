import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { LessonImage } from '@/components/LessonImage';
import { Markdown } from '@/components/Markdown';
import type { LessonImage as LessonImageData, LessonPage } from '@/content';
import { spacing } from '@/theme';

interface Props {
  page: LessonPage;
  /** Images the content assigns to this page; shown right after its text. */
  images: LessonImageData[];
  onLayout?: (e: LayoutChangeEvent) => void;
}

/**
 * One lesson page's text, then the images that belong to it (the text introduces
 * them as "below"). Pages run on as one continuous text, with no labels between them.
 */
export function LessonSection({ page, images, onLayout }: Props) {
  return (
    <View style={styles.section} onLayout={onLayout}>
      <Markdown source={page.body} />
      {images.map((image) => (
        <LessonImage key={image.mediaId} image={image} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.lg },
});

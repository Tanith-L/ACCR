// Minimal renderer for lesson pages: paragraphs, "- " / "1. " lists, **bold**.
// The contract allows "plain text or simple Markdown" per page. Swap for a
// library if lessons ever need headings, links or tables.
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, type } from '@/theme';

type Block = { kind: 'p'; text: string } | { kind: 'ul' | 'ol'; items: string[] };

export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of markdown.trim().split(/\n\s*\n/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length && lines.every((l) => /^[-*]\s+/.test(l))) {
      blocks.push({ kind: 'ul', items: lines.map((l) => l.replace(/^[-*]\s+/, '')) });
    } else if (lines.length && lines.every((l) => /^\d+[.)]\s+/.test(l))) {
      blocks.push({ kind: 'ol', items: lines.map((l) => l.replace(/^\d+[.)]\s+/, '')) });
    } else if (lines.length) {
      blocks.push({ kind: 'p', text: lines.join(' ') });
    }
  }
  return blocks;
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <Text key={i} style={styles.bold}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function Markdown({ source }: { source: string }) {
  return (
    <View style={styles.wrap}>
      {parseBlocks(source).map((block, i) =>
        block.kind === 'p' ? (
          <Text key={i} style={type.body}>
            <Inline text={block.text} />
          </Text>
        ) : (
          <View key={i} style={styles.list}>
            {block.items.map((item, j) => (
              <View key={j} style={styles.item}>
                <Text style={type.body}>{block.kind === 'ul' ? '•' : `${j + 1}.`}</Text>
                <Text style={[type.body, styles.itemText]}>
                  <Inline text={item} />
                </Text>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  bold: { fontWeight: '700' },
  list: { gap: spacing.xs },
  item: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  itemText: { flex: 1 },
});

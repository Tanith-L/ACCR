// The PsA knowledge map as a lively radial mind map on one screen. Each branch has its
// own color and picture nodes with a progress ring. Tap a branch to bring it to the
// center, with its parts popping out along curved branches; tap an end point to open
// that lesson; tap the middle or the top to go back a level. All motion stops when the
// system's reduce-motion setting is on.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { KnowledgeNode } from '@/content/knowledgeMap';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors, fonts, radius, shadows, spacing, type BranchColor } from '@/theme';
import { estimateLines, layoutMindMap, type Box } from '@/utils/mindMapLayout';

import { Icon } from './Icon';
import { branchPath, BRANCH_COLORS, DEFAULT_BRANCH_COLOR, NODE_ICONS } from './knowledgeMapStyle';

const POP_MS = 240;
const STAGGER_MS = 40;
const LABEL_SIZE = 16.5;
const LABEL_SIZE_COMPACT = 15;
const LABEL_LINE = 21;
const LABEL_LINE_COMPACT = 18;
const MAX_LABEL_LINES = 3;
const MIN_BUBBLE = 32;
const MAX_BUBBLE = 80;
const COMPACT_BELOW = 92;

const place = ({ x, y, width, height }: Box) => ({ left: x, top: y, width, height });

/**
 * A node's round picture size and where its center sits, leaving room for its label.
 * Nodes well above the middle put the label on top, so their branch doesn't cross it.
 */
function bubbleFor(box: Box, middle: Box, labelLines: number) {
  const compact = box.height < COMPACT_BELOW;
  const room = box.height - (compact ? LABEL_LINE_COMPACT : LABEL_LINE) * labelLines - spacing.xs;
  const size = Math.max(MIN_BUBBLE, Math.min(MAX_BUBBLE, room));
  const labelOnTop = box.y + box.height / 2 < middle.y;
  return {
    size,
    compact,
    labelOnTop,
    cx: box.x + box.width / 2,
    cy: labelOnTop ? box.y + box.height - size / 2 : box.y + size / 2,
  };
}

/** Pops in after a delay, and dips and rebounds when pressed. */
function PopNode({
  box,
  delay,
  children,
  onPress,
  label,
  hint,
  expanded,
  disabled,
}: {
  box: Box;
  delay: number;
  children: ReactNode;
  onPress?: () => void;
  label: string;
  hint?: string;
  expanded?: boolean;
  disabled?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const [appear] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  const [press] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reducedMotion) {
      appear.setValue(1);
      return;
    }
    Animated.timing(appear, { toValue: 1, duration: POP_MS, delay, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start();
  }, [appear, delay, reducedMotion]);

  const animatePress = (toValue: number) => {
    if (reducedMotion) return;
    Animated.spring(press, { toValue, friction: 5, tension: 260, useNativeDriver: true }).start();
  };

  return (
    <Animated.View
      style={[
        styles.pop,
        place(box),
        {
          opacity: appear.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: Animated.multiply(appear.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }), press) }],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={expanded === undefined ? undefined : { expanded }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => animatePress(0.92)}
        onPressOut={() => animatePress(1)}
        style={styles.fill}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** A round picture with a progress ring, plus a small badge for what a tap does. */
function Bubble({
  id,
  size,
  palette,
  progress,
  badge,
}: {
  id: string;
  size: number;
  palette: BranchColor;
  progress: number;
  badge: 'plus' | 'open' | 'done';
}) {
  const ring = 3;
  const r = (size - ring) / 2;
  const circumference = 2 * Math.PI * r;
  const done = badge === 'done';
  const small = size < 44;
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.bubble, shadows.card, { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.soft }]}>
        <MaterialCommunityIcons name={NODE_ICONS[id] ?? 'circle-outline'} size={size * 0.56} color={palette.strong} />
      </View>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface} strokeWidth={ring} fill="none" />
        {progress > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={palette.strong}
            strokeWidth={ring}
            strokeLinecap="round"
            strokeDasharray={`${circumference * progress} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            fill="none"
          />
        )}
      </Svg>
      <View style={[styles.badge, small && styles.badgeSmall, { backgroundColor: done ? colors.success : palette.strong }]}>
        <Icon name={done ? 'check' : badge === 'plus' ? 'plus' : 'arrow-right'} size={small ? 9 : 13} color={colors.primaryText} />
      </View>
    </View>
  );
}

/** Soft rings behind the middle of the map that slowly breathe. */
function Halo({ cx, cy, size, color }: { cx: number; cy: number; size: number; color: string }) {
  const reducedMotion = useReducedMotion();
  const [breath] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reducedMotion) {
      breath.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, reducedMotion]);

  const ring = (scale: number, opacity: number, grow: number) => (
    <Animated.View
      key={scale}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: cx - (size * scale) / 2,
        top: cy - (size * scale) / 2,
        width: size * scale,
        height: size * scale,
        borderRadius: (size * scale) / 2,
        backgroundColor: color,
        opacity,
        transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, grow] }) }],
      }}
    />
  );
  return (
    <>
      {ring(2.5, 0.35, 1.05)}
      {ring(1.6, 0.6, 1.08)}
    </>
  );
}

interface Props {
  root: KnowledgeNode;
  /** Open nodes from the root down, not including the root. */
  openPath: string[];
  onChangePath: (path: string[]) => void;
  isCompleted: (lessonId: string) => boolean;
  countCompleted: (lessonIds: string[]) => number;
  onOpenLesson: (node: KnowledgeNode) => void;
}

export function MindMap({ root, openPath, onChangePath, isCompleted, countCompleted, onOpenLesson }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [lines] = useState(() => new Animated.Value(1));
  const reducedMotion = useReducedMotion();
  const firstRender = useRef(true);

  // Walk down the open path; an id that is no longer published just stops the walk.
  const trail = [root];
  for (const id of openPath) {
    const next = trail[trail.length - 1].children.find((c) => c.id === id);
    if (!next) break;
    trail.push(next);
  }
  const focus = trail[trail.length - 1];
  const parent = trail[trail.length - 2] ?? null;
  const layout = layoutMindMap(focus.children.length, !!parent, size.width, size.height);
  const middle = layout.center ?? layout.hub;
  const pathKey = trail.map((n) => n.id).join('/');
  const currentPath = trail.slice(1).map((n) => n.id);
  const goUp = () => onChangePath(currentPath.slice(0, -1));

  // Everything under a top-level branch shares its color; at the root each node has its own.
  const inherited = trail[1] ? (BRANCH_COLORS[trail[1].id] ?? DEFAULT_BRANCH_COLOR) : null;
  const paletteOf = (node: KnowledgeNode) => inherited ?? BRANCH_COLORS[node.id] ?? DEFAULT_BRANCH_COLOR;
  const middleColor = inherited?.strong ?? colors.primary;
  const midX = middle.x + middle.width / 2;
  const midY = middle.y + middle.height / 2;
  // Every node in a ring is sized for its longest label, so the ring looks even.
  const ringBox = layout.ring[0];
  const labelLines = ringBox
    ? Math.min(
        MAX_LABEL_LINES,
        Math.max(
          ...focus.children.map((c) =>
            estimateLines(c.label, ringBox.width, ringBox.height < COMPACT_BELOW ? LABEL_SIZE_COMPACT : LABEL_SIZE),
          ),
        ),
      )
    : 1;

  useEffect(() => {
    if (firstRender.current || reducedMotion) {
      firstRender.current = false;
      lines.setValue(1);
      return;
    }
    lines.setValue(0);
    Animated.timing(lines, { toValue: 1, duration: POP_MS, useNativeDriver: true }).start();
  }, [pathKey, lines, reducedMotion]);

  return (
    <View style={styles.canvas} onLayout={(e) => setSize(e.nativeEvent.layout)}>
      {size.height > 0 && (
        <>
          <Halo cx={midX} cy={midY} size={Math.min(middle.width, middle.height)} color={inherited?.soft ?? colors.primarySoft} />

          <Animated.View style={[StyleSheet.absoluteFill, { opacity: lines }]} pointerEvents="none">
            <Svg width={size.width} height={size.height}>
              {parent && (
                <Path
                  d={branchPath(midX, midY, layout.hub.x + layout.hub.width / 2, layout.hub.y + layout.hub.height / 2, 1, 5, 3)}
                  fill={colors.primaryDisabled}
                />
              )}
              {layout.ring.map((box, i) => {
                const node = focus.children[i];
                const { cx, cy } = bubbleFor(box, middle, labelLines);
                return <Path key={node.id} d={branchPath(midX, midY, cx, cy, i % 2 ? -1 : 1)} fill={paletteOf(node).strong} opacity={0.75} />;
              })}
            </Svg>
          </Animated.View>

          {/* Keyed by level, so each move re-runs the pop-out. */}
          <View key={pathKey} style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {parent ? (
              <PopNode box={layout.hub} delay={0} onPress={goUp} label={`Back to ${parent.label}`}>
                <View style={[styles.backPill, shadows.card]}>
                  <Icon name="chevron-left" size={16} color={colors.primary} />
                  <Text style={styles.backText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2}>
                    {parent.label}
                  </Text>
                </View>
              </PopNode>
            ) : (
              <PopNode box={layout.hub} delay={0} label={root.label} disabled>
                <View style={[styles.middle, shadows.card, { backgroundColor: colors.primary, borderRadius: layout.hub.height / 2 }]}>
                  <MaterialCommunityIcons name={NODE_ICONS[root.id]} size={30} color={colors.primaryText} />
                  <Text style={styles.middleText} numberOfLines={2} maxFontSizeMultiplier={1.2}>
                    {root.label}
                  </Text>
                </View>
              </PopNode>
            )}

            {layout.center && (
              <PopNode
                box={layout.center}
                delay={0}
                onPress={goUp}
                expanded
                label={`${focus.label}, open, ${countCompleted(focus.lessonIds)} of ${focus.lessonIds.length} lessons finished. Tap to go back`}
              >
                <View style={[styles.middle, shadows.card, { backgroundColor: middleColor, borderRadius: radius.lg + 6 }]}>
                  <MaterialCommunityIcons name={NODE_ICONS[focus.id] ?? 'circle-outline'} size={24} color={colors.primaryText} />
                  <Text style={[styles.middleText, layout.center.width < 92 && styles.middleTextNarrow]} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2}>
                    {focus.label}
                  </Text>
                </View>
              </PopNode>
            )}

            {focus.children.map((node, i) => {
              const box = layout.ring[i];
              const { size: bubble, compact, labelOnTop } = bubbleFor(box, middle, labelLines);
              const nodeStyle = labelOnTop ? styles.nodeLabelOnTop : styles.node;
              const palette = paletteOf(node);
              const delay = (i + 1) * STAGGER_MS;
              const labelStyle = [styles.label, compact && styles.labelCompact];
              const labelText = (
                <Text style={labelStyle} numberOfLines={MAX_LABEL_LINES} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={1.2}>
                  {node.label}
                </Text>
              );
              if (node.lesson) {
                const done = isCompleted(node.lesson.id);
                return (
                  <PopNode
                    key={node.id}
                    box={box}
                    delay={delay}
                    onPress={() => onOpenLesson(node)}
                    label={done ? `${node.label}, lesson finished` : node.label}
                    hint="Opens the lesson"
                  >
                    <View style={nodeStyle}>
                      <Bubble id={node.id} size={bubble} palette={palette} progress={done ? 1 : 0} badge={done ? 'done' : 'open'} />
                      {labelText}
                    </View>
                  </PopNode>
                );
              }
              const finished = countCompleted(node.lessonIds);
              const total = node.lessonIds.length;
              return (
                <PopNode
                  key={node.id}
                  box={box}
                  delay={delay}
                  onPress={() => onChangePath([...currentPath, node.id])}
                  expanded={false}
                  label={`${node.label}, ${node.children.length} parts, ${finished} of ${total} lessons finished`}
                >
                  <View style={nodeStyle}>
                    <Bubble
                      id={node.id}
                      size={bubble}
                      palette={palette}
                      progress={total ? finished / total : 0}
                      badge={total > 0 && finished === total ? 'done' : 'plus'}
                    />
                    {labelText}
                  </View>
                </PopNode>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  pop: { position: 'absolute' },
  fill: { flex: 1 },
  node: { flex: 1, alignItems: 'center', gap: spacing.xs },
  nodeLabelOnTop: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', flexDirection: 'column-reverse', gap: spacing.xs },
  bubble: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 23,
    height: 23,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeSmall: { right: -6, bottom: -5, width: 17, height: 17, borderRadius: 9, borderWidth: 1.5 },
  label: { fontFamily: fonts.semibold, fontSize: LABEL_SIZE, lineHeight: LABEL_LINE, color: colors.text, textAlign: 'center' },
  labelCompact: { fontSize: LABEL_SIZE_COMPACT, lineHeight: LABEL_LINE_COMPACT },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: spacing.xs },
  middleText: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 19, color: colors.primaryText, textAlign: 'center' },
  middleTextNarrow: { fontSize: 14, lineHeight: 17 },
  backPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryDisabled,
    backgroundColor: colors.surface,
  },
  backText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.primary },
});

// Positions for the radial mind map. Nodes sit on an ellipse around a center,
// clockwise from the top, in rows that divide the height evenly, so even a dozen
// labels fit a phone without overlapping or scrolling. Opening a branch moves it
// to the center with its parts around it, and the level above moves to the top.

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MindMapLayout {
  hub: Box;
  /** The open branch in the center, or null when the hub is in the center. */
  center: Box | null;
  /** The nodes around the center. */
  ring: Box[];
}

const MAX_NODE_WIDTH = 150;
const NODE_WIDTH_SHARE = 0.35;
const MAX_NODE_HEIGHT = 150;
const ROW_GAP = 8;
const CENTER_GAP = 12;
const HUB_SIZE = 100;
const SMALL_HUB_WIDTH = 216;
const SMALL_HUB_HEIGHT = 44;

const nodeWidthFor = (width: number) => Math.min(MAX_NODE_WIDTH, width * NODE_WIDTH_SHARE);

/** `middle` is the half size of what sits at the ring's center, which nodes level with it must clear. */
function ring(count: number, width: number, top: number, bottom: number, middle: { halfWidth: number; halfHeight: number }): Box[] {
  const nodeWidth = nodeWidthFor(width);
  const rx = width / 2 - nodeWidth / 2;
  const ry = (bottom - top) / 2;
  const cy = top + ry;
  // Both sides use the fuller side's height, so all the nodes in a ring match.
  const height = Math.min((bottom - top) / Math.ceil(count / 2) - ROW_GAP, MAX_NODE_HEIGHT);

  const column = (rows: number, side: 1 | -1) =>
    Array.from({ length: rows }, (_, i) => {
      const rowHeight = (bottom - top) / rows;
      const y = top + rowHeight * (i + 0.5);
      const dy = (y - cy) / ry;
      // Follow the ellipse, but never let the two sides meet in the middle.
      let offset = Math.max(rx * Math.sqrt(1 - dy * dy), nodeWidth / 2 + CENTER_GAP / 2);
      const levelWithMiddle = Math.abs(y - cy) - height / 2 < middle.halfHeight;
      if (levelWithMiddle) offset = Math.min(rx, Math.max(offset, middle.halfWidth + CENTER_GAP / 2 + nodeWidth / 2));
      return { x: width / 2 + side * offset - nodeWidth / 2, y: y - height / 2, width: nodeWidth, height };
    });

  const right = column(Math.ceil(count / 2), 1);
  const left = column(Math.floor(count / 2), -1).reverse();
  return [...right, ...left];
}

export function layoutMindMap(count: number, branchOpen: boolean, width: number, height: number): MindMapLayout {
  if (!branchOpen) {
    return {
      hub: { x: (width - HUB_SIZE) / 2, y: (height - HUB_SIZE) / 2, width: HUB_SIZE, height: HUB_SIZE },
      center: null,
      ring: ring(count, width, 0, height, { halfWidth: HUB_SIZE / 2, halfHeight: HUB_SIZE / 2 }),
    };
  }
  const top = SMALL_HUB_HEIGHT + ROW_GAP;
  // Narrow enough to clear the nodes level with it on either side, which sit near the full ellipse width.
  const nodeWidth = nodeWidthFor(width);
  const centerWidth = Math.min(MAX_NODE_WIDTH, 2 * (0.96 * (width / 2 - nodeWidth / 2) - nodeWidth / 2) - CENTER_GAP);
  const centerHeight = 100;
  return {
    hub: { x: (width - SMALL_HUB_WIDTH) / 2, y: 0, width: SMALL_HUB_WIDTH, height: SMALL_HUB_HEIGHT },
    center: { x: (width - centerWidth) / 2, y: top + (height - top - centerHeight) / 2, width: centerWidth, height: centerHeight },
    ring: ring(count, width, top, height, { halfWidth: centerWidth / 2, halfHeight: centerHeight / 2 }),
  };
}

/** Roughly how many lines a label wraps to, so a ring can give spare room to its pictures. */
export function estimateLines(label: string, width: number, fontSize: number): number {
  const perLine = Math.floor(width / (fontSize * 0.5));
  let lines = 1;
  let used = 0;
  for (const word of label.split(' ')) {
    if (used && used + 1 + word.length > perLine) {
      lines += 1;
      used = word.length;
    } else {
      used += (used ? 1 : 0) + word.length;
    }
  }
  return lines;
}

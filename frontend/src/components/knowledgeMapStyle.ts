// How the knowledge map looks: a color family for each top-level branch, inherited by
// everything under it, and a picture icon for each node. Kept apart from the content
// in content/knowledgeMap.ts. A test checks every node has an icon that exists.
import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import { branchColors, type BranchColor } from '@/theme';

export type MapIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const BRANCH_COLORS: Record<string, BranchColor> = {
  what: branchColors.green,
  dx: branchColors.orange,
  where: branchColors.teal,
  treatment: branchColors.plum,
  tracking: branchColors.gold,
};

export const DEFAULT_BRANCH_COLOR = branchColors.green;

export const NODE_ICONS: Record<string, MapIconName> = {
  psa: 'human-handsup',

  what: 'help-circle-outline',
  'what-inflammation': 'fire',
  'what-psoriasis': 'link-variant',
  'what-six': 'view-grid-outline',
  'what-terms': 'book-open-variant',

  dx: 'stethoscope',
  'dx-story': 'account-voice',
  'dx-tests': 'test-tube',
  'dx-caspar': 'clipboard-list-outline',
  'caspar-inflammation': 'fire',
  'caspar-psoriasis': 'account-group-outline',
  'caspar-nails': 'hand-back-right-outline',
  'caspar-swelling': 'hand-pointing-up',
  'caspar-rf': 'water-outline',
  'caspar-bone': 'bone',

  where: 'human',
  'where-skin': 'layers-outline',
  'where-nails': 'hand-back-right-outline',
  'where-joints': 'bone',
  'where-spine': 'human-male-height',
  'where-digits': 'hand-pointing-up',
  'where-tendons': 'foot-print',
  'where-eyes': 'eye-outline',
  'where-gut': 'stomach',
  'where-related': 'heart-pulse',
  'joints-shoulders': 'arm-flex-outline',
  'joints-elbows': 'arm-flex',
  'joints-hands': 'hand-back-left-outline',
  'joints-hips': 'walk',
  'joints-knees': 'run',
  'joints-ankles': 'shoe-sneaker',

  treatment: 'pill',
  'tx-goals': 'bullseye-arrow',
  'tx-ease': 'hand-heart-outline',
  'tx-conventional': 'pill',
  'tx-biologic': 'dna',
  'tx-targeted': 'target',
  'tx-questions': 'comment-question-outline',

  tracking: 'chart-line',
  'track-mda': 'gauge',
  'track-signs': 'clipboard-check-outline',
  'track-daily': 'calendar-check-outline',
  'track-flares': 'weather-lightning',
  'track-record': 'notebook-outline',
};

/** A tapered, gently curved branch from one point to another, as a filled shape. */
export function branchPath(x1: number, y1: number, x2: number, y2: number, bend: 1 | -1, startWidth = 7, endWidth = 2.5): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const curve = Math.min(length * 0.16, 26) * bend;
  const cx = (x1 + x2) / 2 + nx * curve;
  const cy = (y1 + y2) / 2 + ny * curve;
  const mid = (startWidth + endWidth) / 4;
  const n = (v: number) => Math.round(v * 10) / 10;
  return [
    `M${n(x1 + (nx * startWidth) / 2)} ${n(y1 + (ny * startWidth) / 2)}`,
    `Q${n(cx + nx * mid)} ${n(cy + ny * mid)} ${n(x2 + (nx * endWidth) / 2)} ${n(y2 + (ny * endWidth) / 2)}`,
    `L${n(x2 - (nx * endWidth) / 2)} ${n(y2 - (ny * endWidth) / 2)}`,
    `Q${n(cx - nx * mid)} ${n(cy - ny * mid)} ${n(x1 - (nx * startWidth) / 2)} ${n(y1 - (ny * startWidth) / 2)}`,
    'Z',
  ].join(' ');
}

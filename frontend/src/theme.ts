// Design tokens: a fresh, leafy green with a warm apricot accent on a warm off-white.
// Chosen for warmth and for contrast, which older patients value most, and red is kept
// for real warnings. Text pairs are checked against WCAG AA in src/__tests__/content.test.ts.
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  background: '#FBFAF3',
  surface: '#FFFFFF',
  border: '#E5E4D8',
  text: '#232E27',
  textMuted: '#59655C',
  primary: '#2E7A4F',
  primaryPressed: '#24633F',
  primaryDisabled: '#AFCFB6',
  primaryText: '#FFFFFF',
  primarySoft: '#E3F2E5',
  accentSoft: '#FFEBDD',
  accentText: '#94461A',
  success: '#1F7344',
  danger: '#B3261E',
  imagePanel: '#F1F4EA',
};

export interface BranchColor {
  /** Node backgrounds. */
  soft: string;
  /** Icons, branches and progress on `soft`; white text on it in the map's middle. */
  strong: string;
}

/** A color family for each part of the knowledge map. */
export const branchColors = {
  green: { soft: '#E3F2E5', strong: '#2E7A4F' },
  teal: { soft: '#DDF2EF', strong: '#14746F' },
  orange: { soft: '#FFEBDD', strong: '#A94E0C' },
  plum: { soft: '#F6E6F2', strong: '#8E3B7A' },
  gold: { soft: '#FBF1CC', strong: '#826400' },
} satisfies Record<string, BranchColor>;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  /** Screen titles: a system serif reads warmer than the sans body text. */
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
  /** The RheumNotes wordmark is set in a serif. */
  serif: Platform.select({ ios: 'Times New Roman', android: 'serif', default: '"Times New Roman", Times, serif' }),
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 12, md: 18, lg: 24, pill: 999 };

/** WCAG 2.2 comfortable tap size, also kinder to sore hands. */
export const minTouch = 44;

export const shadows = {
  card: { boxShadow: '0 2px 10px rgba(31, 42, 55, 0.08)' },
} satisfies Record<string, ViewStyle>;

export const type = {
  /** Big screen titles: Welcome, Care Team, Settings, Knowledge Check. */
  display: { fontFamily: fonts.display, fontWeight: '700', fontSize: 32, lineHeight: 40, color: colors.text },
  /** Smaller screen titles, e.g. "Your learning topics". */
  title: { fontFamily: fonts.display, fontWeight: '700', fontSize: 27, lineHeight: 34, color: colors.text },
  /** Lesson and question titles. */
  headline: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2, color: colors.text },
  /** Card titles. */
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 28, color: colors.text },
  /** Intro text under a title. */
  lead: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, color: colors.textMuted },
  caption: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: colors.textMuted },
  eyebrow: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.primary,
  },
} satisfies Record<string, TextStyle>;

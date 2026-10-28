// Design tokens from the Figma prototype (ACCR Prototype): deep teal on a
// soft grey-green background, white cards with hairline borders, Inter type.
import { Platform, type TextStyle } from 'react-native';

export const colors = {
  background: '#F2F6F4',
  surface: '#FFFFFF',
  border: '#DCE5E2',
  text: '#1C2B31',
  textMuted: '#6C7A7F',
  primary: '#2E6E65',
  primaryPressed: '#245A52',
  primaryDisabled: '#9DBDB6',
  primaryText: '#FFFFFF',
  primarySoft: '#DCECE8',
  success: '#2E7D57',
  danger: '#B65151',
  imagePanel: '#EAF1EE',
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  /** The RheumNotes wordmark is set in a serif. */
  serif: Platform.select({ ios: 'Times New Roman', android: 'serif', default: '"Times New Roman", Times, serif' }),
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 12, md: 16, lg: 20, pill: 999 };

export const type = {
  /** Big screen titles: Welcome, Care Team, Settings, Knowledge Check. */
  display: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 41, letterSpacing: -0.6, color: colors.text },
  /** Smaller screen titles, e.g. "Your learning topics". */
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.3, color: colors.text },
  /** Lesson and question titles. */
  headline: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2, color: colors.text },
  /** Card titles. */
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 25, color: colors.text },
  /** Intro text under a title. */
  lead: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.textMuted },
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

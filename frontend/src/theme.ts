// Design tokens. TODO(frontend): replace with the values from the Figma file.
export const colors = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  text: '#1B1F24',
  textMuted: '#5B6470',
  primary: '#2F6FB2',
  primaryText: '#FFFFFF',
  primarySoft: '#E6F0FA',
  success: '#2E7D4F',
  successSoft: '#E5F4EA',
  warning: '#8A5A00',
  warningSoft: '#FFF4D6',
  danger: '#B3261E',
  border: '#E1E5EA',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 6, md: 12, lg: 16, pill: 999 };

export const type = {
  title: { fontSize: 26, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 19, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 17, lineHeight: 26, color: colors.text },
  caption: { fontSize: 14, color: colors.textMuted },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.4, color: colors.textMuted },
};

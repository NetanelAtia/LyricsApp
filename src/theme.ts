// Central place for all colors and styling tokens.
// Changing a value here updates the whole app — keeps the design consistent.

export const colors = {
  background: '#0f0f1a',
  surface: '#1a1a2e',
  surfaceLight: '#252540',
  primary: '#6c5ce7',
  primarySoft: '#a29bfe',
  text: '#ffffff',
  textMuted: '#9aa0b4',
  textFaint: '#6b7088',
  success: '#00b894',
  warning: '#fdcb6e',
  danger: '#ff7675',
  highlight: '#ffe066', // currently-spoken word in karaoke mode
};

// Difficulty badge colors
export const difficultyColor = {
  Easy: colors.success,
  Medium: colors.warning,
  Hard: colors.danger,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
};

// Rubik — a clean, modern Google Font with proper Hebrew glyphs — for
// buttons and body text. Suez One — a distinctive Hebrew display/serif
// font — for headings, so they stand out from the system default font.
// Both are loaded via expo-font in App.tsx.
export const fonts = {
  regular: 'Rubik_400Regular',
  medium: 'Rubik_500Medium',
  bold: 'Rubik_700Bold',
  extraBold: 'Rubik_800ExtraBold',
  display: 'SuezOne_400Regular',
};

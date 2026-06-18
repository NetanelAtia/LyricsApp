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

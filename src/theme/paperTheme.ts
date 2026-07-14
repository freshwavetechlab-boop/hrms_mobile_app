import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { darkColors, lightColors } from './colors';

export const createPaperTheme = (isDark: boolean) => {
  const baseTheme = isDark ? MD3DarkTheme : MD3LightTheme;
  const colors = isDark ? darkColors : lightColors;

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      secondary: colors.secondary,
      surface: colors.surface,
      background: colors.surfaceMuted,
      surfaceVariant: colors.surfaceRaised,
      outline: colors.border,
      onSurface: colors.text,
      onSurfaceVariant: colors.textMuted,
      error: colors.warning,
    },
  };
};

export const paperTheme = createPaperTheme(false);

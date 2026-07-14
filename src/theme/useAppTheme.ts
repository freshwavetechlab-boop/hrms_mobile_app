import { useMemo } from 'react';
import { useAppSelector } from '../store/hooks';
import { AppColors, darkColors, lightColors } from './colors';

export const useAppColors = () => {
  const isDark = useAppSelector(state => state.preferences.darkMode);
  return isDark ? darkColors : lightColors;
};

export const useIsDarkMode = () => useAppSelector(state => state.preferences.darkMode);

export const useThemedStyles = <Styles>(factory: (colors: AppColors) => Styles) => {
  const colors = useAppColors();
  return useMemo(() => factory(colors), [colors, factory]);
};

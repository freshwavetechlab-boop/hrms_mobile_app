import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';

export const SkeletonBlock = () => {
  const styles = useThemedStyles(createStyles);
  return <View accessibilityLabel="Loading content" style={styles.block} />;
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  block: {
    backgroundColor: colors.border,
    borderRadius: 8,
    height: 88,
    opacity: 0.45,
  },
});

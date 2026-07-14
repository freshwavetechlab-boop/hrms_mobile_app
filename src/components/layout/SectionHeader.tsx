import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { AppColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';
import { typography } from '../../theme/typography';

export const SectionHeader = ({ title }: { title: string }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <Text accessibilityRole="header" style={styles.title}>
      {title}
    </Text>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  title: {
    ...typography.sectionTitle,
    color: colors.text,
  },
});

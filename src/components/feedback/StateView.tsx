import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { AppColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { PrimaryButton } from '../forms/PrimaryButton';

type Props = {
  type: 'loading' | 'empty' | 'error';
  message: string;
  onRetry?: () => void;
};

export const StateView = ({ type, message, onRetry }: Props) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      {type === 'loading' ? <ActivityIndicator /> : null}
      <Text style={styles.message}>{message}</Text>
      {type === 'error' && onRetry ? <PrimaryButton onPress={onRetry}>Retry</PrimaryButton> : null}
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 120,
    justifyContent: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

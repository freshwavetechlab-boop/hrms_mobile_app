import React, { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { AppColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';

type Props = PropsWithChildren<{
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export const Card = ({ children, muted = false, style }: Props) => {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.card, muted ? styles.muted : undefined, style]}>{children}</View>;
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  muted: {
    backgroundColor: colors.surfaceRaised,
  },
});

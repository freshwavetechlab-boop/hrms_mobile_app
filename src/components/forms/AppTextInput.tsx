import React from 'react';
import { StyleSheet } from 'react-native';
import { TextInput } from 'react-native-paper';
import { AppColors } from '../../theme/colors';
import { useAppColors, useThemedStyles } from '../../theme/useAppTheme';

type Props = React.ComponentProps<typeof TextInput>;

export const AppTextInput = (props: Props) => {
  const colors = useAppColors();
  const styles = useThemedStyles(createStyles);
  return (
    <TextInput
      mode="outlined"
      outlineColor={colors.border}
      activeOutlineColor={colors.primary}
      textColor={colors.text}
      placeholderTextColor={colors.textMuted}
      style={styles.input}
      contentStyle={styles.content}
      {...props}
    />
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
  },
  content: {
    minHeight: 52,
  },
});

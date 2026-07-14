import React, { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppColors } from '../../theme/colors';
import { useAppColors, useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';

type Props = PropsWithChildren<{
  scroll?: boolean;
}>;

export const Screen = ({ children, scroll = true }: Props) => {
  const colors = useAppColors();
  const screenStyles = useThemedStyles(createStyles);
  const content = <View style={screenStyles.content}>{children}</View>;

  return (
    <SafeAreaView style={[screenStyles.safeArea, { backgroundColor: colors.surfaceMuted }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={screenStyles.keyboardAvoidingView}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={screenStyles.scroll}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 88,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
});

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { LockKeyhole, LockOpen } from 'lucide-react-native';
import { Screen } from '../../components/layout/Screen';
import { Card } from '../../components/layout/Card';
import { IconBadge } from '../../components/layout/IconBadge';
import { PrimaryButton } from '../../components/forms/PrimaryButton';
import { biometricService } from '../../services/biometricService';
import { useAppDispatch } from '../../store/hooks';
import { setLocked } from '../../store/slices/securitySlice';
import { AppColors, colors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useTranslation } from '../../localization/useTranslation';

const unlockIcon = () => <LockOpen color={colors.surface} size={18} />;

const AppLockScreen = () => {
  const styles = useThemedStyles(createStyles);
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const unlock = async () => {
    const success = await biometricService.authenticate(t('unlock'));
    if (success) {
      dispatch(setLocked(false));
    }
  };

  return (
    <Screen>
      <Card>
        <IconBadge Icon={LockKeyhole} tone="primary" />
        <Text accessibilityRole="header" style={styles.title}>
          {t('appLocked')}
        </Text>
        <Text style={styles.body}>{t('appLockBody')}</Text>
        <PrimaryButton icon={unlockIcon} onPress={unlock}>
          {t('unlock')}
        </PrimaryButton>
      </Card>
    </Screen>
  );
};

const createStyles = (palette: AppColors) => StyleSheet.create({
  title: {
    ...typography.title,
    color: palette.text,
  },
  body: {
    ...typography.body,
    color: palette.textMuted,
    marginBottom: spacing.sm,
  },
});

export default AppLockScreen;

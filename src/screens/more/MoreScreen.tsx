import React from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import {
  Bell,
  FileArchive,
  FileText,
  GraduationCap,
  Info,
  LockKeyhole,
  LogOut,
  ScrollText,
  Shield,
  Target,
  Users,
  WalletCards,
} from 'lucide-react-native';
import { ActionTile } from '../../components/layout/ActionTile';
import { Card } from '../../components/layout/Card';
import { IconBadge } from '../../components/layout/IconBadge';
import { Screen } from '../../components/layout/Screen';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { PrimaryButton } from '../../components/forms/PrimaryButton';
import { APP_CONFIG } from '../../constants/app';
import { staticModules } from '../../constants/staticData';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import { setDarkMode } from '../../store/slices/preferencesSlice';
import { useTranslation } from '../../localization/useTranslation';
import { AppColors } from '../../theme/colors';
import { useAppColors, useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const MoreScreen = () => {
  const dispatch = useAppDispatch();
  const preferences = useAppSelector(state => state.preferences);
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useThemedStyles(createStyles);
  const logoutIcon = () => <LogOut color={colors.primary} size={18} />;
  const moduleIcons = [
    WalletCards,
    FileArchive,
    Users,
    GraduationCap,
    Target,
    Bell,
  ];

  const onLogout = () => {
    Alert.alert(t('logoutTitle'), t('logoutMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('logout'),
        style: 'destructive',
        onPress: () => {
          dispatch(setDarkMode(false));
          dispatch(logout());
        },
      },
    ]);
  };

  return (
    <Screen>
      <SectionHeader title={t('modules')} />
      <View style={styles.moduleGrid}>
        {staticModules.slice(8).map((item, index) => (
          <ActionTile
            Icon={moduleIcons[index] ?? FileText}
            key={item}
            title={item}
            tone={index % 2 === 0 ? 'primary' : 'accent'}
          />
        ))}
      </View>
      <SectionHeader title={t('settings')} />
      <Card>
        <View style={styles.settingRow}>
          <View style={styles.settingLabel}>
            <IconBadge Icon={Shield} tone="secondary" size={16} />
            <Text style={styles.item}>{t('darkMode')}</Text>
          </View>
          <Switch
            accessibilityLabel="Dark mode"
            thumbColor={preferences.darkMode ? colors.primary : colors.textMuted}
            trackColor={{ false: colors.border, true: colors.primarySoft }}
            onValueChange={value => {
              dispatch(setDarkMode(value));
            }}
            value={preferences.darkMode}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.settingRow}>
          <View style={styles.settingLabel}>
            <IconBadge Icon={LockKeyhole} tone="primary" size={16} />
            <Text style={styles.item}>{t('privacyPolicy')}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.settingRow}>
          <View style={styles.settingLabel}>
            <IconBadge Icon={ScrollText} tone="accent" size={16} />
            <Text style={styles.item}>{t('terms')}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.settingRow}>
          <View style={styles.settingLabel}>
            <IconBadge Icon={Info} tone="secondary" size={16} />
            <Text style={styles.item}>{t('version')}</Text>
          </View>
          <Text style={styles.meta}>{APP_CONFIG.version}</Text>
        </View>
      </Card>
      <PrimaryButton icon={logoutIcon} mode="outlined" onPress={onLogout}>
        {t('logout')}
      </PrimaryButton>
    </Screen>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  item: {
    ...typography.body,
    color: colors.text,
    flexShrink: 1,
    minHeight: 44,
    textAlignVertical: 'center',
  },
  meta: {
    ...typography.body,
    color: colors.textMuted,
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 48,
  },
  settingLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  divider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
  },
});

export default MoreScreen;

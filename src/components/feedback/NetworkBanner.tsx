import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { AppColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useTranslation } from '../../localization/useTranslation';

export const NetworkBanner = () => {
  const styles = useThemedStyles(createStyles);
  const network = useAppSelector(state => state.network);
  const { t } = useTranslation();
  const isOnline = network.isConnected && network.isInternetReachable;
  const label = network.isSyncing ? t('syncing') : isOnline ? t('online') : t('offline');

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Network status ${label}`}
      style={[styles.banner, isOnline ? styles.online : styles.offline]}>
      <Text style={styles.text}>{label}</Text>
      <Text style={styles.meta}>
        {network.lastSyncedAt ? `${t('lastSynced')}: ${new Date(network.lastSyncedAt).toLocaleTimeString()}` : network.type}
      </Text>
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  banner: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  online: {
    backgroundColor: colors.successSoft,
  },
  offline: {
    backgroundColor: colors.warningSoft,
  },
  text: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
});

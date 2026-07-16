import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { LogOut, MapPin } from 'lucide-react-native';
import { Divider, Menu } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../localization/useTranslation';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import { setDarkMode } from '../../store/slices/preferencesSlice';
import { AppColors } from '../../theme/colors';
import { useAppColors, useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { ClientBranding } from '../../types/domain';
import { ClientLogo } from './ClientLogo';

const getAvatarLetters = (name?: string) => {
  const letters = name?.trim().replace(/\s+/g, '').slice(0, 2).toUpperCase();
  return letters || 'HR';
};

const formatRole = (roles?: string[], designation?: string) => {
  const value = roles?.find(Boolean) || designation || 'Employee';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
};

export const AuthenticatedHeader = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useThemedStyles(createStyles);
  const [menuVisible, setMenuVisible] = useState(false);
  const session = useAppSelector(state => state.auth.session);
  const selectedClient = useAppSelector(
    state => state.client.selectedClient ?? state.auth.session?.client,
  );
  const network = useAppSelector(state => state.network);
  const employee = session?.employee;
  const isOnline = network.isConnected && network.isInternetReachable;
  const avatarLetters = getAvatarLetters(employee?.name);
  const role = formatRole(session?.roles, employee?.designation);
  const branding = useMemo<ClientBranding | undefined>(() => {
    if (!selectedClient?.branding) {
      return undefined;
    }
    if (
      selectedClient.code.toUpperCase() === 'GAD' &&
      !selectedClient.branding.logoDataUrl &&
      !selectedClient.branding.logoKey
    ) {
      return { ...selectedClient.branding, logoKey: 'gaDigital' };
    }
    return selectedClient.branding;
  }, [selectedClient]);

  const confirmLogout = () => {
    setMenuVisible(false);
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
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <View pointerEvents="none" style={styles.brand}>
          <ClientLogo branding={branding} size="sm" style={styles.headerLogo} wide />
          <View style={styles.workspaceCopy}>
            <Text style={styles.workspaceLabel}>{t('selectedClient')}</Text>
            <Text numberOfLines={1} style={styles.workspaceCode}>
              {selectedClient?.code ?? '--'}
            </Text>
          </View>
        </View>

        <View style={styles.rightActions}>
          <View
            accessibilityLabel={isOnline ? t('online') : t('offline')}
            accessibilityRole="image"
            style={[
              styles.statusLight,
              { backgroundColor: isOnline ? colors.success : colors.warning },
            ]}
          />
          <Menu
            anchor={(
              <Pressable
                accessibilityLabel="Open profile menu"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setMenuVisible(current => !current)}
                style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}>
                <Text style={styles.avatarText}>{avatarLetters}</Text>
              </Pressable>
            )}
            anchorPosition="bottom"
            contentStyle={styles.menuSurface}
            onDismiss={() => setMenuVisible(false)}
            visible={menuVisible}>
            <View style={styles.accountSummary}>
              <View style={styles.menuAvatar}>
                <Text style={styles.menuAvatarText}>{avatarLetters}</Text>
              </View>
              <View style={styles.accountCopy}>
                <Text numberOfLines={1} style={styles.accountName}>
                  {employee?.name ?? 'Employee'}
                </Text>
                <Text numberOfLines={1} style={styles.accountRole}>
                  {role}
                </Text>
                {employee?.attendanceOffice ? (
                  <View style={styles.accountOffice}>
                    <MapPin color={colors.textMuted} size={14} strokeWidth={2.2} />
                    <Text numberOfLines={2} style={styles.accountOfficeText}>
                      {employee.attendanceOffice}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Divider />
            <Pressable
              accessibilityRole="button"
              onPress={confirmLogout}
              style={({ pressed }) => [styles.logoutAction, pressed && styles.pressed]}>
              <LogOut color={colors.warning} size={19} strokeWidth={2.2} />
              <Text style={styles.logoutText}>{t('logout')}</Text>
            </Pressable>
          </Menu>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  safeArea: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  brand: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    height: '100%',
    justifyContent: 'flex-start',
    marginRight: spacing.sm,
    minWidth: 0,
  },
  headerLogo: {
    borderRadius: 14,
  },
  workspaceCopy: {
    gap: 1,
    maxWidth: 66,
  },
  workspaceLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 13,
  },
  workspaceCode: {
    ...typography.body,
    color: colors.text,
    fontWeight: '800',
    lineHeight: 18,
  },
  rightActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: spacing.md,
    height: '100%',
  },
  statusLight: {
    borderColor: colors.surface,
    borderRadius: 6,
    borderWidth: 2,
    height: 12,
    shadowColor: colors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 3,
    width: 12,
  },
  avatarButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 2,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  avatarText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '800',
  },
  menuSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 238,
  },
  accountSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  menuAvatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  menuAvatarText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
  },
  accountCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  accountName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  accountRole: {
    ...typography.caption,
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: 20,
    color: colors.primary,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  accountOffice: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  accountOfficeText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  logoutAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  logoutText: {
    ...typography.body,
    color: colors.warning,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.68,
  },
});

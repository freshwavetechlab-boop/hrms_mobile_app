import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  Clock3,
  FileText,
  HandCoins,
  UserSearch,
  WalletCards,
} from 'lucide-react-native';
import { ActionTile } from '../../components/layout/ActionTile';
import { Card } from '../../components/layout/Card';
import { ClientLogo } from '../../components/layout/ClientLogo';
import { IconBadge } from '../../components/layout/IconBadge';
import { MetricCard } from '../../components/layout/MetricCard';
import { Screen } from '../../components/layout/Screen';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { NetworkBanner } from '../../components/feedback/NetworkBanner';
import { announcements, holidays as staticHolidays } from '../../constants/staticData';
import { essApiService } from '../../services/essApiService';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { loadAttendanceHistory } from '../../store/slices/attendanceSlice';
import { loadLeaveData } from '../../store/slices/leaveSlice';
import { useTranslation } from '../../localization/useTranslation';
import { AppColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const DashboardScreen = () => {
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<{
    navigate: (screen: string, params?: object) => void;
    getParent: () =>
      | {
          navigate: (screen: string, params?: object) => void;
          getParent?: () => { navigate: (screen: string, params?: object) => void } | undefined;
        }
      | undefined;
  }>();
  const dispatch = useAppDispatch();
  const [holidays, setHolidays] = useState(staticHolidays);
  const { t } = useTranslation();
  const employee = useAppSelector(state => state.auth.session?.employee);
  const client = useAppSelector(state => state.client.selectedClient ?? state.auth.session?.client);
  const latestAttendance = useAppSelector(state => state.attendance.records[0]);
  const leave = useAppSelector(state => state.leave);
  const attendanceType = latestAttendance?.attendanceType === 'CHECK_IN' ? 'CHECK_OUT' : 'CHECK_IN';
  const casualLeaveBalance = leave.balances.CASUAL_LEAVE;
  const pendingLeaveRequests = leave.applications.filter(item => item.status === 'PENDING').length;

  useEffect(() => {
    dispatch(loadAttendanceHistory());
    dispatch(loadLeaveData());
    essApiService
      .getHolidays()
      .then(items => {
        if (items.length > 0) {
          setHolidays(items);
        }
      })
      .catch(() => setHolidays(staticHolidays));
  }, [dispatch]);

  const onCheckIn = () => {
    const tabNavigation = navigation.getParent();
    const parentNavigation = tabNavigation?.getParent?.() ?? navigation;
    parentNavigation.navigate('AttendanceCapture', { attendanceType });
  };

  const onApplyLeave = () => {
    navigation.navigate('Requests');
  };

  return (
    <Screen>
      <NetworkBanner />
      <Card>
        {client ? (
          <View style={styles.clientStrip}>
            <ClientLogo branding={client.branding} size="sm" wide />
            <View style={styles.clientText}>
              <Text style={styles.clientLabel}>{t('selectedClient')}</Text>
              <Text style={styles.clientName}>{client.name}</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.heroRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{employee?.name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.greeting}>{t('goodDay')}</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {employee?.name}
            </Text>
            <Text style={styles.body}>{employee?.designation}</Text>
          </View>
        </View>
        <View style={styles.employeeStrip}>
          <InfoPill label={t('employeeIdShort')} value={employee?.id ?? '--'} />
          <InfoPill label={t('department')} value={employee?.department ?? '--'} />
        </View>
        <View style={styles.attendanceStrip}>
          <IconBadge Icon={CalendarCheck} tone="success" size={18} />
          <View style={styles.heroText}>
            <Text style={styles.cardTitle}>{t('todayAttendance')}</Text>
            <Text style={styles.status}>
              {latestAttendance ? latestAttendance.attendanceType.replace('_', ' ') : t('notMarked')}
            </Text>
          </View>
        </View>
      </Card>
      <View style={styles.grid}>
        <MetricCard Icon={Clock3} label={t('workingHours')} value="08:12" tone="primary" />
        <MetricCard Icon={CalendarDays} label={t('leaveBalance')} value={String(casualLeaveBalance)} tone="secondary" />
        <MetricCard Icon={FileText} label={t('pendingRequests')} value={String(pendingLeaveRequests).padStart(2, '0')} tone="accent" />
        <MetricCard Icon={Bell} label={t('notifications')} value="05" tone="warning" />
      </View>
      <SectionHeader title={t('quickActions')} />
      <View style={styles.actions}>
        <ActionTile
          Icon={CalendarCheck}
          title={attendanceType === 'CHECK_IN' ? t('checkIn') : t('checkOut')}
          subtitle={t('secureAttendance')}
          tone="success"
          onPress={onCheckIn}
        />
        <ActionTile
          Icon={CalendarDays}
          title={t('applyLeave')}
          subtitle={`Balance ${casualLeaveBalance} days`}
          tone="secondary"
          onPress={onApplyLeave}
        />
        <ActionTile Icon={WalletCards} title={t('payslip')} subtitle={t('payslipReady')} tone="primary" />
        <ActionTile Icon={UserSearch} title={t('directory')} subtitle={t('findEmployees')} tone="accent" />
      </View>
      <SectionHeader title={t('upcomingHolidays')} />
      <Card>
        {holidays.map(item => (
          <Text key={item} style={styles.body}>
            {item}
          </Text>
        ))}
      </Card>
      <SectionHeader title={t('companyAnnouncements')} />
      <Card>
        {announcements.map(item => (
          <View key={item} style={styles.announcementRow}>
            <IconBadge Icon={HandCoins} tone="primary" size={16} />
            <Text style={styles.announcementText}>{item}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
};

const InfoPill = ({ label, value }: { label: string; value: string }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  heroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  avatarText: {
    ...typography.sectionTitle,
    color: colors.surface,
  },
  greeting: {
    ...typography.body,
    color: colors.textMuted,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  cardTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
  },
  status: {
    ...typography.body,
    color: colors.success,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  employeeStrip: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  infoPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  attendanceStrip: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  clientStrip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  clientText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  clientLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  clientName: {
    ...typography.body,
    color: colors.text,
    flexShrink: 1,
    fontWeight: '700',
  },
  announcementRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    minWidth: 0,
  },
  announcementText: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
    flexShrink: 1,
    lineHeight: 22,
    minWidth: 0,
  },
});

export default DashboardScreen;

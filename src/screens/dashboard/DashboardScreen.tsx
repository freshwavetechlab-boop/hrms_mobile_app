import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import {
  CalendarCheck,
  CalendarDays,
  FileText,
} from 'lucide-react-native';
import { ActionTile } from '../../components/layout/ActionTile';
import { Card } from '../../components/layout/Card';
import { IconBadge } from '../../components/layout/IconBadge';
import { MetricCard } from '../../components/layout/MetricCard';
import { Screen } from '../../components/layout/Screen';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { StateView } from '../../components/feedback/StateView';
import { MonthYearSelector } from '../../components/forms/MonthYearSelector';
import { useClock } from '../../hooks/useClock';
import { essApiService } from '../../services/essApiService';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { loadAttendanceHistory } from '../../store/slices/attendanceSlice';
import { loadLeaveData } from '../../store/slices/leaveSlice';
import { useTranslation } from '../../localization/useTranslation';
import { AppColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Holiday, LoadingState } from '../../types/domain';
import { formatIsoDateKey } from '../../utils/time';

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
  const now = useClock(60_000);
  const currentMonth = format(now, 'yyyy-MM');
  const [selectedHolidayMonth, setSelectedHolidayMonth] = useState(() => currentMonth);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayStatus, setHolidayStatus] = useState<LoadingState>('idle');
  const holidayRequestId = useRef(0);
  const { t } = useTranslation();
  const employee = useAppSelector(state => state.auth.session?.employee);
  const attendance = useAppSelector(state => state.attendance);
  const leave = useAppSelector(state => state.leave);
  const attendanceRecords =
    attendance.loadedMonth === currentMonth ? attendance.records : [];
  const today = format(now, 'yyyy-MM-dd');
  const latestAttendance = attendanceRecords.find(item => formatIsoDateKey(item.timestamp) === today);
  const latestPunch = attendanceRecords.find(
    item =>
      formatIsoDateKey(item.timestamp) === today &&
      item.isPunchRecord,
  );
  const attendanceType = latestPunch?.attendanceType === 'CHECK_IN' ? 'CHECK_OUT' : 'CHECK_IN';
  const primaryLeave = leave.availableTypes[0];
  const pendingLeaveRequests = leave.applications.filter(item => item.status === 'PENDING').length;

  useFocusEffect(useCallback(() => {
    dispatch(loadAttendanceHistory(currentMonth));
    dispatch(loadLeaveData());
  }, [currentMonth, dispatch]));

  const loadHolidays = useCallback(async () => {
    const requestId = ++holidayRequestId.current;
    setHolidayStatus('loading');
    try {
      const items = await essApiService.getHolidays(selectedHolidayMonth);
      if (requestId !== holidayRequestId.current) {
        return;
      }
      setHolidays(items);
      setHolidayStatus('success');
    } catch {
      if (requestId !== holidayRequestId.current) {
        return;
      }
      setHolidays([]);
      setHolidayStatus('error');
    }
  }, [selectedHolidayMonth]);

  useEffect(() => {
    loadHolidays();
    return () => {
      holidayRequestId.current += 1;
    };
  }, [loadHolidays]);

  const onCheckIn = () => {
    const tabNavigation = navigation.getParent();
    const parentNavigation = tabNavigation?.getParent?.() ?? navigation;
    parentNavigation.navigate('AttendanceCapture', { attendanceType });
  };

  const onApplyLeave = () => {
    navigation.navigate('Requests');
  };

  const onPayslips = () => {
    const tabNavigation = navigation.getParent();
    const parentNavigation = tabNavigation?.getParent?.() ?? navigation;
    parentNavigation.navigate('Payslips');
  };

  return (
    <Screen includeTopInset={false}>
      <Card>
        <View style={styles.employeeStrip}>
          <InfoPill label={t('employeeIdShort')} value={employee?.id ?? '--'} />
          <InfoPill label={t('department')} value={employee?.department ?? '--'} />
        </View>
        <View style={styles.attendanceStrip}>
          <IconBadge Icon={CalendarCheck} tone="success" size={18} />
          <View style={styles.heroText}>
            <Text style={styles.cardTitle}>{t('todayAttendance')}</Text>
            <Text style={styles.status}>
              {latestAttendance
                ? latestAttendance.attendanceStatus || latestAttendance.attendanceType.replace('_', ' ')
                : t('notMarked')}
            </Text>
          </View>
        </View>
      </Card>
      <View style={styles.grid}>
        <MetricCard
          Icon={CalendarDays}
          label={primaryLeave?.leaveType ?? t('leaveBalance')}
          value={primaryLeave ? String(primaryLeave.balance) : '--'}
          tone="secondary"
        />
        <MetricCard Icon={FileText} label={t('pendingRequests')} value={String(pendingLeaveRequests).padStart(2, '0')} tone="accent" />
      </View>
      <SectionHeader title={t('quickActions')} />
      <View style={styles.actions}>
        <ActionTile
          disabled={attendance.loadedMonth !== currentMonth}
          Icon={CalendarCheck}
          title={attendanceType === 'CHECK_IN' ? t('checkIn') : t('checkOut')}
          subtitle={
            attendance.loadedMonth === currentMonth
              ? t('secureAttendance')
              : attendance.status === 'error'
                ? t('attendanceLoadFailed')
                : 'Loading current attendance...'
          }
          tone="success"
          onPress={onCheckIn}
        />
        <ActionTile
          Icon={CalendarDays}
          title={t('applyLeave')}
          subtitle={primaryLeave ? `${primaryLeave.leaveType}: ${primaryLeave.balance} days` : t('leaveBalance')}
          tone="secondary"
          onPress={onApplyLeave}
        />
        <ActionTile
          Icon={FileText}
          title={t('payslips')}
          subtitle={t('payAndTax')}
          tone="primary"
          onPress={onPayslips}
        />
      </View>
      <SectionHeader title={t('holidays')} />
      <MonthYearSelector
        label="Month"
        onChange={setSelectedHolidayMonth}
        value={selectedHolidayMonth}
      />
      <Card>
        {holidayStatus === 'loading' ? (
          <StateView message="Loading holidays..." type="loading" />
        ) : holidayStatus === 'error' ? (
          <StateView message={t('holidayLoadFailed')} onRetry={loadHolidays} type="error" />
        ) : holidays.length === 0 ? (
          <StateView message={t('noHolidaysForMonth')} type="empty" />
        ) : (
          holidays.map(item => (
            <View key={`${item.name}-${item.startDate}`} style={styles.holidayRow}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.body}>
                {format(parseISO(item.startDate), 'dd MMM yyyy')}
                {item.endDate.slice(0, 10) !== item.startDate.slice(0, 10)
                  ? ` - ${format(parseISO(item.endDate), 'dd MMM yyyy')}`
                  : ''}
              </Text>
            </View>
          ))
        )}
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
  heroText: {
    flex: 1,
    gap: spacing.xs,
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
  holidayRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
});

export default DashboardScreen;

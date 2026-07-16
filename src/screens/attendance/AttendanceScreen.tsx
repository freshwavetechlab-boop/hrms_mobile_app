import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns/format';
import {
  CalendarClock,
  Clock3,
  FileSpreadsheet,
  FileText,
  LogIn,
  LogOut,
} from 'lucide-react-native';
import { Button, Menu } from 'react-native-paper';
import { Card } from '../../components/layout/Card';
import { IconBadge } from '../../components/layout/IconBadge';
import { Screen } from '../../components/layout/Screen';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { MonthYearSelector } from '../../components/forms/MonthYearSelector';
import { PrimaryButton } from '../../components/forms/PrimaryButton';
import { StateView } from '../../components/feedback/StateView';
import { useClock } from '../../hooks/useClock';
import { RootStackParamList } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  loadAttendanceHistory,
  loadAttendancePeriod,
  loadAttendanceToday,
} from '../../store/slices/attendanceSlice';
import { useTranslation } from '../../localization/useTranslation';
import { attendanceExportService } from '../../services/attendanceExportService';
import { AppColors, colors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { AttendancePeriodScope } from '../../types/domain';
import { formatDate, formatTime } from '../../utils/time';

const punchInIcon = () => <LogIn color={colors.surface} size={18} />;
const punchOutIcon = () => <LogOut color={colors.surface} size={18} />;

const formatApiTime = (value?: string) => {
  if (!value) {
    return '--';
  }
  const [hours = '0', minutes = '0'] = value.split(':');
  const date = new Date(2000, 0, 1, Number(hours), Number(minutes));
  return Number.isNaN(date.getTime()) ? value : format(date, 'hh:mm a');
};

const formatPeriodDate = (value?: string) => {
  if (!value) {
    return '';
  }
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : format(date, 'dd MMM yyyy');
};

const AttendanceScreen = () => {
  const styles = useThemedStyles(createStyles);
  const now = useClock();
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const attendance = useAppSelector(state => state.attendance);
  const session = useAppSelector(state => state.auth.session);
  const selectedClient = useAppSelector(
    state => state.client.selectedClient ?? state.auth.session?.client,
  );
  const currentMonth = format(now, 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(() => currentMonth);
  const [periodScope, setPeriodScope] =
    useState<AttendancePeriodScope>('calendar-month');
  const [periodMenuVisible, setPeriodMenuVisible] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel'>();
  const periodHistory = attendance.periodHistory;
  const requestedPeriodKey = `${periodScope}:${selectedMonth}`;
  const periodHasCache = periodHistory.loadedKey === requestedPeriodKey;
  const periodRequestMatchesSelection =
    periodHistory.requestedKey === requestedPeriodKey;
  const periodRefreshFailed =
    periodRequestMatchesSelection && periodHistory.status === 'error';
  const selectedPeriodRecords = periodHasCache ? periodHistory.records : [];
  const todayAttendance = attendance.today.data;
  const todayStateReady = attendance.today.status === 'success' && Boolean(todayAttendance);
  const attendanceCompleted = todayAttendance?.nextExpectedAction === 'Completed';
  const attendanceApprovalPending =
    todayAttendance?.approvalPending === true ||
    todayAttendance?.nextExpectedAction === 'WaitForApproval';
  const attendanceSyncPending = todayAttendance?.syncPending === true;
  const canPunchIn =
    selectedMonth === currentMonth &&
    todayStateReady &&
    todayAttendance?.nextExpectedAction === 'CheckIn' &&
    !attendanceApprovalPending &&
    !attendanceSyncPending;
  const canPunchOut =
    selectedMonth === currentMonth &&
    todayStateReady &&
    todayAttendance?.nextExpectedAction === 'CheckOut' &&
    !attendanceApprovalPending &&
    !attendanceSyncPending;
  const resolvedPeriodLabel = periodHasCache
    ? `${formatPeriodDate(periodHistory.fromDate)} - ${formatPeriodDate(periodHistory.toDate)}`
    : selectedMonth;
  const periodErrorMessage =
    periodHistory.error === 'ATTENDANCE_POLICY_CONFLICT'
      ? t('attendancePolicyConflict')
      : periodHistory.error === 'ATTENDANCE_POLICY_INVALID'
        ? t('attendancePolicyInvalid')
        : t('attendanceLoadFailed');

  useFocusEffect(
    useCallback(() => {
      dispatch(loadAttendanceHistory(currentMonth));
      dispatch(loadAttendanceToday());
      dispatch(loadAttendancePeriod({ month: selectedMonth, scope: periodScope }));
    }, [currentMonth, dispatch, periodScope, selectedMonth]),
  );

  useEffect(() => {
    if (
      periodScope === 'attendance-cycle' &&
      periodHistory.status === 'success' &&
      periodHistory.cycleAvailable === false
    ) {
      setPeriodScope('calendar-month');
    }
  }, [periodHistory.cycleAvailable, periodHistory.status, periodScope]);

  const onPunchAttendance = (attendanceType: 'CHECK_IN' | 'CHECK_OUT') => {
    navigation.navigate('AttendanceCapture', { attendanceType });
  };

  const canExport =
    periodHasCache &&
    selectedPeriodRecords.length > 0 &&
    Boolean(session?.employee) &&
    !exporting;

  const shareAttendance = async (type: 'pdf' | 'excel') => {
    if (!canExport || !session?.employee) {
      return;
    }
    setExporting(type);
    try {
      const input = {
        clientName: selectedClient?.name ?? session.client.name,
        employee: session.employee,
        month: selectedMonth,
        records: selectedPeriodRecords,
        scope: periodScope,
        fromDate: periodHistory.fromDate,
        toDate: periodHistory.toDate,
        policyName: periodHistory.policy?.name,
      };
      if (type === 'pdf') {
        await attendanceExportService.sharePdf(input);
      } else {
        await attendanceExportService.shareExcel(input);
      }
    } catch {
      Alert.alert(t('attendanceExportFailed'), t('attendanceExportFailedMessage'));
    } finally {
      setExporting(undefined);
    }
  };

  return (
    <Screen includeTopInset={false}>
      <Card>
        <View style={styles.clockHeader}>
          <IconBadge Icon={Clock3} tone="primary" />
          <View style={styles.clockText}>
            <Text accessibilityRole="timer" style={styles.time}>
              {formatTime(now)}
            </Text>
            <Text style={styles.date}>{formatDate(now)}</Text>
          </View>
        </View>
        <View style={styles.statusGrid}>
          <StatusItem
            Icon={CalendarClock}
            label="Today status"
            value={todayAttendance?.status ?? t('notMarked')}
          />
          <StatusItem
            Icon={Clock3}
            label="Punch in"
            value={formatApiTime(todayAttendance?.checkInTime)}
          />
          <StatusItem
            Icon={Clock3}
            label="Punch out"
            value={formatApiTime(todayAttendance?.checkOutTime)}
          />
          <StatusItem
            Icon={CalendarClock}
            label="Total hours"
            value={todayAttendance?.checkOutTime
              ? `${todayAttendance.totalHours.toFixed(2)} hrs`
              : '--'}
          />
        </View>
        {todayAttendance ? (
          <Text style={styles.shiftSummary}>
            Shift {formatApiTime(todayAttendance.shiftCheckInTime)} - {formatApiTime(todayAttendance.shiftCheckOutTime)} · Half day {todayAttendance.minimumHoursForHalfDay}h · Full day {todayAttendance.minimumHoursForFullDay}h · Max {todayAttendance.maximumHoursAllowedForFullDay}h
          </Text>
        ) : null}
        {attendance.today.status === 'error' ? (
          <StateView
            message={t('attendanceLoadFailed')}
            onRetry={() => dispatch(loadAttendanceToday())}
            type="error"
          />
        ) : null}
        <View style={styles.punchActions}>
          <View style={styles.punchAction}>
            <PrimaryButton
              disabled={!canPunchIn}
              icon={punchInIcon}
              loading={attendance.today.status === 'loading'}
              onPress={() => onPunchAttendance('CHECK_IN')}>
              {attendanceSyncPending ? 'Pending sync' : 'Punch In'}
            </PrimaryButton>
          </View>
          <View style={styles.punchAction}>
            <PrimaryButton
              disabled={!canPunchOut}
              icon={punchOutIcon}
              mode="contained-tonal"
              onPress={() => onPunchAttendance('CHECK_OUT')}>
              {attendanceCompleted ? 'Completed' : 'Punch Out'}
            </PrimaryButton>
          </View>
        </View>
      </Card>
      <View style={styles.historyHeader}>
        <View style={styles.historyTitle}>
          <SectionHeader title={t('attendanceHistory')} />
        </View>
        <View style={styles.exportActions}>
          <ExportAction
            accessibilityLabel={t('shareAttendancePdf')}
            disabled={!canExport}
            Icon={FileText}
            label={t('sharePdf')}
            loading={exporting === 'pdf'}
            onPress={() => shareAttendance('pdf')}
          />
          <ExportAction
            accessibilityLabel={t('shareAttendanceExcel')}
            disabled={!canExport}
            Icon={FileSpreadsheet}
            label={t('shareExcel')}
            loading={exporting === 'excel'}
            onPress={() => shareAttendance('excel')}
          />
        </View>
      </View>
      <View style={styles.periodControls}>
        <View style={styles.monthControl}>
          <MonthYearSelector
            compact
            maximumMonth={currentMonth}
            onChange={setSelectedMonth}
            value={selectedMonth}
          />
        </View>
        <Menu
          anchor={
            <Button
              accessibilityLabel={t('attendancePeriod')}
              compact
              contentStyle={styles.periodButtonContent}
              labelStyle={styles.periodButtonLabel}
              mode="outlined"
              onPress={() => setPeriodMenuVisible(true)}
              style={styles.periodButton}>
              {periodScope === 'calendar-month'
                ? t('currentMonth')
                : t('attendanceCycle')}
            </Button>
          }
          onDismiss={() => setPeriodMenuVisible(false)}
          visible={periodMenuVisible}>
          <Menu.Item
            onPress={() => {
              setPeriodScope('calendar-month');
              setPeriodMenuVisible(false);
            }}
            title={t('currentMonth')}
          />
          <Menu.Item
            disabled={!periodHistory.cycleAvailable}
            onPress={() => {
              setPeriodScope('attendance-cycle');
              setPeriodMenuVisible(false);
            }}
            title={t('attendanceCycle')}
          />
        </Menu>
      </View>
      {periodHasCache ? (
        <View accessibilityLiveRegion="polite" style={styles.periodMeta}>
          <Text style={styles.periodRange}>{resolvedPeriodLabel}</Text>
          {periodHistory.policy?.name ? (
            <Text style={styles.periodPolicy}>{periodHistory.policy.name}</Text>
          ) : !periodHistory.cycleAvailable ? (
            <Text style={styles.periodPolicy}>{t('attendanceCycleUnavailable')}</Text>
          ) : null}
        </View>
      ) : null}
      <Card>
        {periodRefreshFailed ? (
          <StateView
            message={periodErrorMessage}
            onRetry={() =>
              dispatch(loadAttendancePeriod({ month: selectedMonth, scope: periodScope }))
            }
            type="error"
          />
        ) : null}
        {!periodHasCache ? (
          periodRefreshFailed ? null : (
            <StateView type="loading" message={t('validatingAttendance')} />
          )
        ) : selectedPeriodRecords.length === 0 ? (
          <StateView message={t('emptyState')} type="empty" />
        ) : (
          selectedPeriodRecords.map(record => (
            <View key={record.id} style={styles.historyRow}>
              <Text style={styles.historyType}>
                {record.attendanceStatus || record.attendanceType.replace('_', ' ')}
              </Text>
              <Text style={styles.historyMeta}>
                {formatDate(new Date(record.timestamp))}
                {record.remarks ? ` - ${record.remarks}` : ''}
                {record.syncStatus !== 'SYNCED' ? ` - ${record.syncStatus}` : ''}
              </Text>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
};

const ExportAction = ({
  accessibilityLabel,
  disabled,
  Icon,
  label,
  loading,
  onPress,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  Icon: React.ComponentProps<typeof IconBadge>['Icon'];
  label: string;
  loading: boolean;
  onPress: () => void;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.exportAction,
        disabled ? styles.exportActionDisabled : undefined,
        pressed ? styles.exportActionPressed : undefined,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.primary} size={16} />
      ) : (
        <Icon color={colors.primary} size={16} strokeWidth={2.1} />
      )}
      <Text style={styles.exportActionText}>{label}</Text>
    </Pressable>
  );
};

const StatusItem = ({
  Icon,
  label,
  value,
}: {
  Icon: React.ComponentProps<typeof IconBadge>['Icon'];
  label: string;
  value: string;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.statusItem}>
      <IconBadge Icon={Icon} tone="secondary" size={16} />
      <View style={styles.statusCopy}>
        <Text style={styles.statusLabel}>{label}</Text>
        <Text style={styles.statusValue}>{value}</Text>
      </View>
    </View>
  );
};

const createStyles = (palette: AppColors) => StyleSheet.create({
  clockHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  clockText: {
    flex: 1,
    gap: spacing.xs,
  },
  time: {
    ...typography.title,
    color: palette.text,
  },
  date: {
    ...typography.body,
    color: palette.textMuted,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statusItem: {
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
    borderRadius: 8,
    flexBasis: '47%',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.md,
  },
  statusCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  statusLabel: {
    ...typography.caption,
    color: palette.textMuted,
  },
  statusValue: {
    ...typography.body,
    color: palette.text,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  shiftSummary: {
    ...typography.caption,
    backgroundColor: palette.primarySoft,
    borderRadius: 8,
    color: palette.textMuted,
    lineHeight: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  punchActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  punchAction: {
    flex: 1,
    minWidth: 0,
  },
  historyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  historyTitle: {
    flex: 1,
    minWidth: 0,
  },
  periodControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  monthControl: {
    flex: 1,
    minWidth: 0,
  },
  periodButton: {
    borderColor: palette.border,
    borderRadius: 8,
    flexShrink: 0,
    minWidth: 132,
  },
  periodButtonContent: {
    minHeight: 46,
  },
  periodButtonLabel: {
    ...typography.caption,
    color: palette.primary,
    fontWeight: '700',
    marginHorizontal: spacing.sm,
  },
  periodMeta: {
    backgroundColor: palette.primarySoft,
    borderRadius: 8,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  periodRange: {
    ...typography.body,
    color: palette.text,
    fontWeight: '700',
  },
  periodPolicy: {
    ...typography.caption,
    color: palette.textMuted,
  },
  exportActions: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: spacing.sm,
  },
  exportAction: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.primary,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  exportActionDisabled: {
    borderColor: palette.border,
    opacity: 0.48,
  },
  exportActionPressed: {
    opacity: 0.68,
  },
  exportActionText: {
    ...typography.caption,
    color: palette.primary,
    fontWeight: '700',
  },
  historyRow: {
    borderBottomColor: palette.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  historyType: {
    ...typography.body,
    color: palette.text,
    fontWeight: '700',
  },
  historyMeta: {
    ...typography.caption,
    color: palette.textMuted,
  },
});

export default AttendanceScreen;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarDays, Send } from 'lucide-react-native';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { Card } from '../../components/layout/Card';
import { IconBadge } from '../../components/layout/IconBadge';
import { Screen } from '../../components/layout/Screen';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { AppTextInput } from '../../components/forms/AppTextInput';
import { DatePickerField } from '../../components/forms/DatePickerField';
import { PrimaryButton } from '../../components/forms/PrimaryButton';
import { StateView } from '../../components/feedback/StateView';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { applyLeave, loadLeaveData } from '../../store/slices/leaveSlice';
import { useTranslation } from '../../localization/useTranslation';
import { LeaveApplication, LeaveType } from '../../types/domain';
import { AppColors, colors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const sendIcon = () => <Send color={colors.surface} size={18} />;
type LeaveDayType = NonNullable<LeaveApplication['dayType']>;

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : undefined;
  }
  return undefined;
};

const RequestsScreen = () => {
  const styles = useThemedStyles(createStyles);
  const dispatch = useAppDispatch();
  const leave = useAppSelector(state => state.leave);
  const { t } = useTranslation();
  const [leaveType, setLeaveType] = useState<LeaveType>('');
  const [dayType, setDayType] = useState<LeaveDayType>('Full Day');
  const [fromDate, setFromDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      dispatch(loadLeaveData());
    }, [dispatch]),
  );

  useEffect(() => {
    const currentType = leave.availableTypes.find(item => item.key === leaveType);
    if (!currentType && leave.availableTypes[0]) {
      setLeaveType(leave.availableTypes[0].key);
      setDayType('Full Day');
    } else if (currentType && !currentType.allowHalfDay && dayType !== 'Full Day') {
      setDayType('Full Day');
    }
  }, [dayType, leave.availableTypes, leaveType]);

  const selectedType = leave.availableTypes.find(item => item.key === leaveType);

  const showLeaveError = (message?: string) => {
    const errorText =
      message === 'INVALID_LEAVE_DATES'
        ? t('leaveInvalidDates')
        : message === 'INVALID_LEAVE_RANGE'
          ? t('leaveInvalidRange')
          : message === 'LEAVE_REASON_REQUIRED'
            ? t('leaveReasonRequired')
            : message === 'INSUFFICIENT_LEAVE_BALANCE'
              ? t('leaveInsufficientBalance')
              : message === 'LEAVE_TYPE_UNAVAILABLE'
                ? 'This leave type is not active for your profile. Please contact HR.'
              : message === 'LEAVE_HALF_DAY_UNAVAILABLE'
                ? 'Half-day leave is not enabled for this leave type.'
              : message === 'SESSION_EXPIRED'
                ? t('sessionExpired')
                : t('leaveGenericFailure');

    Alert.alert(t('leaveRequestFailed'), errorText);
  };

  const submitLeave = async () => {
    if (submittingRef.current) {
      return;
    }
    try {
      submittingRef.current = true;
      setIsSubmitting(true);
      await dispatch(applyLeave({ leaveType, dayType, fromDate, toDate, reason })).unwrap();
      // Re-read balances and workflow state after the mutation. The request is
      // already successful, so a refresh failure must not be presented as an
      // apply failure.
      dispatch(loadLeaveData());
      setReason('');
      Alert.alert(t('leaveSubmitted'), t('leaveSubmittedMessage'));
    } catch (error) {
      showLeaveError(getErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Screen includeTopInset={false}>
      <SectionHeader title={t('leaveManagement')} />
      {leave.status === 'error' && leave.availableTypes.length === 0 ? (
        <StateView
          message={t('leaveGenericFailure')}
          onRetry={() => dispatch(loadLeaveData())}
          type="error"
        />
      ) : leave.availableTypes.length === 0 ? (
        <StateView
          message={leave.status === 'loading' ? 'Loading leave types...' : 'No leave types are available.'}
          type={leave.status === 'loading' ? 'loading' : 'empty'}
        />
      ) : (
        <View style={styles.balanceGrid}>
          {leave.availableTypes.map(item => (
            <Card key={item.key} muted style={styles.balanceCard}>
              <View style={styles.balanceHeader}>
                <IconBadge Icon={CalendarDays} tone="primary" />
                <Text style={styles.balanceValue}>{item.balance} days</Text>
              </View>
              <Text style={styles.balanceLabel}>{item.leaveType}</Text>
            </Card>
          ))}
        </View>
      )}

      <Card>
        <Text accessibilityRole="header" style={styles.formTitle}>{t('applyLeave')}</Text>
        <View style={styles.typeGrid}>
          {leave.availableTypes.map(item => {
            const selected = leaveType === item.key;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={item.key}
                onPress={() => setLeaveType(item.key)}
                style={[styles.typeOption, selected ? styles.typeOptionSelected : undefined]}>
                <IconBadge Icon={CalendarDays} tone={selected ? 'success' : 'secondary'} size={16} />
                <View style={styles.typeCopy}>
                  <Text style={styles.typeTitle}>{item.leaveType}</Text>
                  <Text style={styles.typeDescription}>
                    {item.leaveCode} - {item.balance} day{item.balance === 1 ? '' : 's'} available
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {selectedType?.allowHalfDay ? (
          <View style={styles.dayTypeRow}>
            {([
              ['Full Day', t('fullDay')],
              ['First Half', t('firstHalf')],
              ['Second Half', t('secondHalf')],
            ] as Array<[LeaveDayType, string]>).map(([value, label]) => {
              const selected = dayType === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={value}
                  onPress={() => setDayType(value)}
                  style={[styles.dayTypeOption, selected ? styles.dayTypeOptionSelected : undefined]}>
                  <Text style={[styles.dayTypeText, selected ? styles.dayTypeTextSelected : undefined]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <DatePickerField
          accessibilityLabel="From date"
          label={t('fromDate')}
          onChange={value => {
            setFromDate(value);
            if (value > toDate) {
              setToDate(value);
            }
          }}
          value={fromDate}
        />
        <DatePickerField
          accessibilityLabel="To date"
          label={t('toDate')}
          minimumDate={parseISO(fromDate)}
          onChange={setToDate}
          value={toDate}
        />
        <AppTextInput
          accessibilityLabel="Leave reason"
          label={t('reason')}
          multiline
          numberOfLines={3}
          onChangeText={setReason}
          value={reason}
        />
        <PrimaryButton
          disabled={!selectedType || isSubmitting || leave.status === 'loading'}
          icon={sendIcon}
          loading={isSubmitting}
          onPress={submitLeave}>
          {t('submitLeaveRequest')}
        </PrimaryButton>
      </Card>

      <SectionHeader title={t('leaveHistory')} />
      <Card>
        {leave.applications.length === 0 ? (
          <Text style={styles.empty}>{t('noLeaveRequests')}</Text>
        ) : (
          leave.applications.map(item => (
            <View key={item.id} style={styles.historyRow}>
              <IconBadge Icon={CalendarDays} tone="primary" size={16} />
              <View style={styles.historyCopy}>
                <Text style={styles.historyTitle}>
                  {item.leaveTypeName || item.leaveCode || item.leaveType} - {item.days} day{item.days === 1 ? '' : 's'}
                </Text>
                <Text style={styles.historyMeta}>
                  {format(parseISO(item.fromDate), 'dd MMM yyyy')} to{' '}
                  {format(parseISO(item.toDate), 'dd MMM yyyy')} - {item.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
};

const createStyles = (palette: AppColors) => StyleSheet.create({
  balanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  balanceCard: {
    width: '48%',
  },
  balanceHeader: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  balanceValue: {
    ...typography.body,
    color: palette.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  balanceLabel: {
    ...typography.caption,
    color: palette.textMuted,
    textAlign: 'center',
  },
  formTitle: {
    ...typography.sectionTitle,
    color: palette.text,
  },
  typeGrid: {
    gap: spacing.md,
  },
  typeOption: {
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.md,
  },
  typeOptionSelected: {
    backgroundColor: palette.successSoft,
    borderColor: palette.success,
  },
  typeCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  typeTitle: {
    ...typography.body,
    color: palette.text,
    fontWeight: '700',
  },
  typeDescription: {
    ...typography.caption,
    color: palette.textMuted,
  },
  dayTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayTypeOption: {
    backgroundColor: palette.surfaceMuted,
    borderColor: palette.border,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dayTypeOptionSelected: {
    backgroundColor: palette.primarySoft,
    borderColor: palette.primary,
  },
  dayTypeText: {
    ...typography.caption,
    color: palette.textMuted,
  },
  dayTypeTextSelected: {
    color: palette.primary,
    fontWeight: '700',
  },
  empty: {
    ...typography.body,
    color: palette.textMuted,
  },
  historyRow: {
    alignItems: 'center',
    borderBottomColor: palette.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  historyCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  historyTitle: {
    ...typography.body,
    color: palette.text,
    fontWeight: '700',
  },
  historyMeta: {
    ...typography.caption,
    color: palette.textMuted,
  },
});

export default RequestsScreen;

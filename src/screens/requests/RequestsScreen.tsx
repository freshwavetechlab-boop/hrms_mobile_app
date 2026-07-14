import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BriefcaseBusiness,
  CalendarDays,
  CalendarHeart,
  CarFront,
  CircleDollarSign,
  ClipboardCheck,
  Home,
  Plane,
  Repeat2,
  Send,
} from 'lucide-react-native';
import { ActionTile } from '../../components/layout/ActionTile';
import { Card } from '../../components/layout/Card';
import { IconBadge } from '../../components/layout/IconBadge';
import { Screen } from '../../components/layout/Screen';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { AppTextInput } from '../../components/forms/AppTextInput';
import { PrimaryButton } from '../../components/forms/PrimaryButton';
import { getLeaveLabel, leaveTypes } from '../../constants/leave';
import { staticModules } from '../../constants/staticData';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { applyLeave, loadLeaveData } from '../../store/slices/leaveSlice';
import { useTranslation } from '../../localization/useTranslation';
import { LeaveType } from '../../types/domain';
import { AppColors, colors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const sendIcon = () => <Send color={colors.surface} size={18} />;
const leaveIcons: Record<LeaveType, React.ComponentProps<typeof IconBadge>['Icon']> = {
  CASUAL_LEAVE: CalendarDays,
  LOSS_OF_PAY: CircleDollarSign,
  MATERNITY: CalendarHeart,
};

const requestItems = staticModules.slice(1, 8);
const requestIcons = [
  Repeat2,
  Home,
  BriefcaseBusiness,
  ClipboardCheck,
  CircleDollarSign,
  CarFront,
  Plane,
];

const today = new Date().toISOString().slice(0, 10);

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
  const [leaveType, setLeaveType] = useState<LeaveType>('CASUAL_LEAVE');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reason, setReason] = useState('');

  useEffect(() => {
    dispatch(loadLeaveData());
  }, [dispatch]);

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
              : message === 'SESSION_EXPIRED'
                ? t('sessionExpired')
                : t('leaveGenericFailure');

    Alert.alert(t('leaveRequestFailed'), errorText);
  };

  const submitLeave = async () => {
    try {
      await dispatch(applyLeave({ leaveType, fromDate, toDate, reason })).unwrap();
      setReason('');
      Alert.alert(t('leaveSubmitted'), t('leaveSubmittedMessage'));
    } catch (error) {
      showLeaveError(getErrorMessage(error));
    }
  };

  return (
    <Screen>
      <SectionHeader title={t('leaveManagement')} />
      <View style={styles.balanceGrid}>
        {leaveTypes.map(item => {
          const Icon = leaveIcons[item.type];
          const value =
            item.type === 'LOSS_OF_PAY' ? 'Unlimited' : `${leave.balances[item.type]} days`;

          return (
            <Card key={item.type} muted style={styles.balanceCard}>
              <View style={styles.balanceHeader}>
                <IconBadge Icon={Icon} tone={item.type === 'LOSS_OF_PAY' ? 'accent' : 'primary'} />
                <Text style={styles.balanceValue}>{value}</Text>
              </View>
              <Text style={styles.balanceLabel}>{item.label}</Text>
            </Card>
          );
        })}
      </View>

      <Card>
        <Text accessibilityRole="header" style={styles.formTitle}>{t('applyLeave')}</Text>
        <View style={styles.typeGrid}>
          {leaveTypes.map(item => {
            const Icon = leaveIcons[item.type];
            const selected = leaveType === item.type;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={item.type}
                onPress={() => setLeaveType(item.type)}
                style={[styles.typeOption, selected ? styles.typeOptionSelected : undefined]}>
                <IconBadge Icon={Icon} tone={selected ? 'success' : 'secondary'} size={16} />
                <View style={styles.typeCopy}>
                  <Text style={styles.typeTitle}>{item.label}</Text>
                  <Text style={styles.typeDescription}>{item.description}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <AppTextInput
          accessibilityLabel="From date"
          label={t('fromDate')}
          onChangeText={setFromDate}
          value={fromDate}
        />
        <AppTextInput
          accessibilityLabel="To date"
          label={t('toDate')}
          onChangeText={setToDate}
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
        <PrimaryButton icon={sendIcon} loading={leave.status === 'loading'} onPress={submitLeave}>
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
              <IconBadge Icon={leaveIcons[item.leaveType]} tone="primary" size={16} />
              <View style={styles.historyCopy}>
                <Text style={styles.historyTitle}>
                  {getLeaveLabel(item.leaveType)} - {item.days} day{item.days > 1 ? 's' : ''}
                </Text>
                <Text style={styles.historyMeta}>
                  {item.fromDate} to {item.toDate} - {item.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>

      <SectionHeader title={t('otherRequests')} />
      <View style={styles.grid}>
        {requestItems.map((item, index) => (
          <ActionTile
            Icon={requestIcons[index]}
            key={item}
            title={item}
            subtitle={t('createAndTrack')}
            tone={index % 2 === 0 ? 'primary' : 'secondary'}
          />
        ))}
      </View>
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
    width: '31%',
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});

export default RequestsScreen;

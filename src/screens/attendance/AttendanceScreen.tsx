import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  LocateFixed,
  ScanFace,
  ShieldPlus,
  TimerReset,
} from 'lucide-react-native';
import { Card } from '../../components/layout/Card';
import { IconBadge } from '../../components/layout/IconBadge';
import { Screen } from '../../components/layout/Screen';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { NetworkBanner } from '../../components/feedback/NetworkBanner';
import { PrimaryButton } from '../../components/forms/PrimaryButton';
import { StateView } from '../../components/feedback/StateView';
import { useClock } from '../../hooks/useClock';
import { RootStackParamList } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { checkFaceEnrollment } from '../../store/slices/authSlice';
import { loadAttendanceHistory } from '../../store/slices/attendanceSlice';
import { useTranslation } from '../../localization/useTranslation';
import { AppColors, colors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatDate, formatTime } from '../../utils/time';

const markIcon = () => <CheckCircle2 color={colors.surface} size={18} />;
const registerFaceIcon = () => <ShieldPlus color={colors.surface} size={18} />;

const AttendanceScreen = () => {
  const styles = useThemedStyles(createStyles);
  const now = useClock();
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const attendance = useAppSelector(state => state.attendance);
  const employeeId = useAppSelector(state => state.auth.session?.employee.id);
  const faceEnrollmentStatus = useAppSelector(state => state.auth.faceEnrollmentStatus);
  const [refreshing, setRefreshing] = useState(false);
  const latest = attendance.records[0];
  const today = new Date().toISOString().slice(0, 10);
  const latestToday = attendance.records.find(record => record.timestamp.slice(0, 10) === today);

  useEffect(() => {
    dispatch(loadAttendanceHistory());
  }, [dispatch]);

  useEffect(() => {
    if (employeeId && faceEnrollmentStatus === 'unknown') {
      dispatch(checkFaceEnrollment(employeeId));
    }
  }, [dispatch, employeeId, faceEnrollmentStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(loadAttendanceHistory());
    setRefreshing(false);
  }, [dispatch]);

  const onMarkAttendance = () => {
    if (faceEnrollmentStatus !== 'registered') {
      navigation.navigate('FaceEnrollment');
      return;
    }
    navigation.navigate('AttendanceCapture', {
      attendanceType: latestToday?.attendanceType === 'CHECK_IN' ? 'CHECK_OUT' : 'CHECK_IN',
    });
  };

  const faceStatusLabel =
    faceEnrollmentStatus === 'registered'
      ? t('faceRegisteredStatus')
      : faceEnrollmentStatus === 'checking' || faceEnrollmentStatus === 'unknown'
        ? t('checkingFaceStatus')
        : t('faceNotRegistered');

  return (
    <Screen>
      <NetworkBanner />
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
            label={t('checkIn')}
            value={latest?.attendanceType === 'CHECK_IN' ? formatTime(new Date(latest.timestamp)) : '--'}
          />
          <StatusItem
            Icon={TimerReset}
            label={t('checkOut')}
            value={latest?.attendanceType === 'CHECK_OUT' ? formatTime(new Date(latest.timestamp)) : '--'}
          />
          <StatusItem Icon={ScanFace} label={t('face')} value={faceStatusLabel} />
          <StatusItem Icon={LocateFixed} label={t('location')} value={attendance.locationStatus} />
        </View>
        {faceEnrollmentStatus === 'required' ? (
          <View style={styles.faceRegistrationPanel}>
            <View style={styles.faceRegistrationHeader}>
              <IconBadge Icon={ScanFace} tone="warning" />
              <View style={styles.faceRegistrationCopy}>
                <Text style={styles.faceRegistrationTitle}>{t('faceNotRegistered')}</Text>
                <Text style={styles.faceRegistrationBody}>
                  {t('faceRegistrationRequiredForAttendance')}
                </Text>
              </View>
            </View>
            <PrimaryButton icon={registerFaceIcon} onPress={() => navigation.navigate('FaceEnrollment')}>
              {t('registerFace')}
            </PrimaryButton>
          </View>
        ) : null}
        <PrimaryButton
          disabled={faceEnrollmentStatus !== 'registered'}
          icon={markIcon}
          loading={attendance.status === 'loading'}
          onPress={onMarkAttendance}>
          {t('markAttendance')}
        </PrimaryButton>
      </Card>
      {attendance.status === 'loading' ? <StateView type="loading" message={t('validatingAttendance')} /> : null}
      <SectionHeader title={t('last7Days')} />
      <Card>
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        {attendance.records.length === 0 ? (
          <Text style={styles.empty}>{t('emptyState')}</Text>
        ) : (
          attendance.records.slice(0, 7).map(record => (
            <View key={record.id} style={styles.historyRow}>
              <Text style={styles.historyType}>{record.attendanceType.replace('_', ' ')}</Text>
              <Text style={styles.historyMeta}>
                {formatDate(new Date(record.timestamp))} - {record.syncStatus}
              </Text>
            </View>
          ))
        )}
      </Card>
    </Screen>
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
  faceRegistrationPanel: {
    backgroundColor: palette.warningSoft,
    borderRadius: 8,
    gap: spacing.md,
    padding: spacing.md,
  },
  faceRegistrationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  faceRegistrationCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  faceRegistrationTitle: {
    ...typography.body,
    color: palette.text,
    fontWeight: '700',
  },
  faceRegistrationBody: {
    ...typography.caption,
    color: palette.textMuted,
  },
  empty: {
    ...typography.body,
    color: palette.textMuted,
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

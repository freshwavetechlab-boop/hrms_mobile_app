import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import {
  Camera as CameraIcon,
  ChevronLeft,
  LocateFixed,
  MapPinOff,
  Satellite,
  X,
} from 'lucide-react-native';
import { Card } from '../../components/layout/Card';
import { IconBadge } from '../../components/layout/IconBadge';
import { Screen } from '../../components/layout/Screen';
import { PrimaryButton } from '../../components/forms/PrimaryButton';
import { AppTextInput } from '../../components/forms/AppTextInput';
import { RootStackParamList } from '../../navigation/types';
import { MOCK_LOCATION_MESSAGE } from '../../services/locationIntegrityService';
import { locationService } from '../../services/locationService';
import { permissionService } from '../../services/permissionService';
import { biometricService } from '../../services/biometricService';
import { useAppDispatch } from '../../store/hooks';
import { markAttendance } from '../../store/slices/attendanceSlice';
import { useTranslation } from '../../localization/useTranslation';
import { AppColors, colors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const backIcon = () => <ChevronLeft color={colors.primary} size={18} />;
const captureIcon = () => <CameraIcon color={colors.surface} size={18} />;
const cameraIcon = () => <CameraIcon color={colors.surface} size={18} />;
const gpsIcon = () => <Satellite color={colors.primary} size={18} />;

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

const AttendanceCaptureScreen = () => {
  const styles = useThemedStyles(createStyles);
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AttendanceCapture'>>();
  const { t } = useTranslation();
  const device = useCameraDevice('front');
  const { canRequestPermission, hasPermission, requestPermission } = useCameraPermission();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [showGpsRecovery, setShowGpsRecovery] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isPreviewReady, setIsPreviewReady] = useState(false);
  const [requiresReason, setRequiresReason] = useState(false);
  const [outsideReason, setOutsideReason] = useState('');

  useEffect(() => {
    if (!showGpsRecovery) {
      return undefined;
    }

    const refreshGpsRecovery = async () => {
      try {
        await locationService.getCurrentPosition();
        setShowGpsRecovery(false);
      } catch (error) {
        setShowGpsRecovery(locationService.isLocationSettingsDisabledError(error));
      }
    };

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        refreshGpsRecovery();
      }
    });

    return () => subscription.remove();
  }, [showGpsRecovery]);

  const showFailure = (error: unknown) => {
    const message = getErrorMessage(error);

    if (message === 'MOCK_LOCATION_DETECTED') {
      Alert.alert('Mock location blocked', MOCK_LOCATION_MESSAGE);
      return;
    }
    if (message === 'LOCATION_SETTINGS_DISABLED') {
      setShowGpsRecovery(true);
      Alert.alert(t('gpsRequiredTitle'), t('gpsRequiredMessage'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('enableGps'), onPress: () => locationService.openLocationSettings() },
      ]);
      return;
    }
    if (message === 'LOCATION_UNAVAILABLE') {
      Alert.alert(t('securityCheckFailed'), t('securityCheckFailedMessage'));
      return;
    }
    if (message === 'OUTSIDE_GEOFENCE') {
      Alert.alert(t('outsideOfficeTitle'), t('outsideOffice'));
      return;
    }
    if (message === 'LOCATION_ACCURACY_LOW') {
      Alert.alert(
        'Improve GPS accuracy',
        'Wait a few seconds in an open area, then retry when your phone has a stronger GPS fix.',
      );
      return;
    }
    if (message === 'ATTENDANCE_REASON_REQUIRED') {
      setRequiresReason(true);
      setIsPreviewReady(false);
      setIsCameraOpen(true);
      Alert.alert(
        'Reason required',
        'Your attendance policy allows this location with a reason. Enter the reason below, wait for the camera preview, and submit again.',
      );
      return;
    }
    if (message === 'ALREADY_CHECKED_IN') {
      Alert.alert('Already checked in', 'Your check-in is already recorded. Please use Check Out.');
      return;
    }
    if (message === 'ALREADY_CHECKED_OUT') {
      Alert.alert('Already checked out', 'Your check-out is already recorded for today.');
      return;
    }
    if (message === 'CHECK_IN_REQUIRED') {
      Alert.alert('Check-in required', 'Please record a valid check-in before checking out.');
      return;
    }
    if (message === 'ATTENDANCE_APPROVAL_PENDING') {
      Alert.alert(
        'Approval pending',
        'This attendance action is already waiting for approval.',
      );
      return;
    }
    if (message === 'ATTENDANCE_APPROVAL_UNAVAILABLE') {
      Alert.alert(
        'Move inside the office area',
        'Outside-office approval is not configured yet. Move inside the allowed attendance area and retry.',
      );
      return;
    }
    if (message === 'ATTENDANCE_ACTION_NOT_ALLOWED') {
      Alert.alert(
        'Action not allowed',
        'This attendance action is disabled by your attendance policy. Please contact HR.',
      );
      return;
    }
    if (
      message === 'ATTENDANCE_STATE_CONFLICT' ||
      message === 'ATTENDANCE_REQUEST_CONFLICT' ||
      message === 'ATTENDANCE_DEVICE_CONTEXT_REQUIRED' ||
      message === 'ATTENDANCE_EMPLOYEE_NOT_FOUND' ||
      message === 'ATTENDANCE_EMPLOYEE_INACTIVE'
    ) {
      Alert.alert(
        'Attendance setup issue',
        'Your attendance profile needs correction. Please contact HR.',
      );
      return;
    }
    if (message === 'ATTENDANCE_CAMERA_REQUIRED') {
      Alert.alert(
        'Camera confirmation required',
        'Open the front camera and wait for the preview before marking attendance.',
      );
      return;
    }
    if (message === 'BIOMETRIC_NOT_ENROLLED') {
      Alert.alert(
        'Fingerprint not enrolled',
        'Add a fingerprint in your phone settings, then retry attendance.',
      );
      return;
    }
    if (message === 'BIOMETRIC_CANCELLED') {
      Alert.alert(t('biometricCancelled'), t('attendanceBiometricCancelled'));
      return;
    }
    if (message === 'ATTENDANCE_BIOMETRIC_REQUIRED') {
      Alert.alert(
        'Biometric confirmation required',
        'Confirm your fingerprint after the camera preview before submitting attendance.',
      );
      return;
    }
    if (message === 'ATTENDANCE_DATE_LOCKED') {
      Alert.alert(
        'Attendance already finalized',
        'This date already contains leave, holiday, or weekly-off attendance. Contact HR if it needs correction.',
      );
      return;
    }
    if (message === 'ATTENDANCE_DEVICE_TIME_INVALID') {
      Alert.alert(
        'Correct device time',
        'Enable automatic date and time on your phone, then retry attendance.',
      );
      return;
    }
    if (
      message === 'ATTENDANCE_SERVER_ERROR' ||
      message === 'ATTENDANCE_API_REJECTED' ||
      message === 'ATTENDANCE_API_INVALID_RESPONSE'
    ) {
      Alert.alert(t('attendanceServiceUnavailable'), t('attendanceServiceUnavailableMessage'));
      return;
    }
    Alert.alert(
      t('attendanceFailed'),
      t('attendanceFailedMessage'),
    );
  };

  const captureAttendance = async () => {
    if (submittingRef.current || !isCameraOpen || !isPreviewReady || !hasPermission || !device) {
      return;
    }

    try {
      submittingRef.current = true;
      setIsSubmitting(true);

      setIsCameraOpen(false);

      await biometricService.authenticateForAttendance();

      const locationGranted = await permissionService.requestLocation();
      if (!locationGranted) {
        setShowGpsRecovery(false);
        Alert.alert(t('locationPermissionDenied'), t('locationPermissionAttendance'));
        return;
      }

      let location;
      try {
        location = await locationService.getCurrentPosition();
        setShowGpsRecovery(false);
      } catch (error) {
        if (locationService.isLocationSettingsDisabledError(error)) {
          setShowGpsRecovery(true);
          throw new Error('LOCATION_SETTINGS_DISABLED');
        }
        if (locationService.isLocationUnavailableError(error)) {
          setShowGpsRecovery(false);
          throw new Error('LOCATION_UNAVAILABLE');
        }
        throw error;
      }
      if (location.mocked) {
        throw new Error('MOCK_LOCATION_DETECTED');
      }

      const savedAttendance = await dispatch(
        markAttendance({
          attendanceType: route.params.attendanceType,
          cameraCaptureConfirmed: true,
          biometricConfirmed: true,
          location,
          reason: outsideReason,
        }),
      ).unwrap();

      if (savedAttendance.attendanceStatus === 'Pending Approval') {
        Alert.alert(
          'Approval pending',
          'Your attendance request was submitted and is waiting for approval.',
          [{ text: t('done'), onPress: () => navigation.goBack() }],
        );
      } else if (savedAttendance.attendanceStatus === 'Pending Sync') {
        Alert.alert(
          'Saved on this device',
          'Attendance is waiting to sync. Keep internet access on; the app will retry automatically.',
          [{ text: t('done'), onPress: () => navigation.goBack() }],
        );
      } else {
        Alert.alert(t('attendanceSaved'), t('attendanceSavedMessage'), [
          { text: t('done'), onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      showFailure(error);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const openCamera = async () => {
    if (!device) {
      Alert.alert(t('frontCameraRequired'), t('frontCameraRequired'));
      return;
    }

    const permissionGranted =
      hasPermission || (canRequestPermission ? await requestPermission() : false);
    if (!permissionGranted) {
      Alert.alert(t('frontCameraRequired'), t('frontCameraRequired'));
      return;
    }

    setIsPreviewReady(false);
    setIsCameraOpen(true);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <PrimaryButton icon={backIcon} mode="outlined" onPress={() => navigation.goBack()}>
          {t('back')}
        </PrimaryButton>
        <View style={styles.headerText}>
          <Text accessibilityRole="header" style={styles.title}>
            {route.params.attendanceType === 'CHECK_IN' ? t('secureCheckIn') : t('secureCheckOut')}
          </Text>
          <Text style={styles.subtitle}>{t('attendanceCaptureSubtitle')}</Text>
        </View>
      </View>
      <Card>
        <View style={styles.cameraFrame}>
          {isCameraOpen && hasPermission && device ? (
            <Camera
              device={device}
              isActive
              onPreviewStarted={() => setIsPreviewReady(true)}
              onPreviewStopped={() => setIsPreviewReady(false)}
              style={styles.camera}
            />
          ) : (
            <View style={styles.cameraFallback}>
              <IconBadge Icon={CameraIcon} tone="primary" />
              <Text style={styles.fallbackTitle}>{t('cameraStandby')}</Text>
              <Text style={styles.fallbackText}>{t('cameraStandbyMessage')}</Text>
            </View>
          )}
          <View style={styles.captureBadge}>
            <CameraIcon color={colors.surface} size={22} strokeWidth={2.4} />
          </View>
          {isCameraOpen ? (
            <Pressable
              accessibilityLabel={t('closeCamera')}
              accessibilityRole="button"
              onPress={() => {
                setIsPreviewReady(false);
                setIsCameraOpen(false);
              }}
              style={styles.closeCameraButton}>
              <X color={colors.surface} size={20} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.securityGrid}>
          <SecurityItem Icon={CameraIcon} title={t('selfieAudit')} value={t('backendCanVerifyFace')} />
          <SecurityItem Icon={LocateFixed} title={t('preciseGps')} value={t('officeRadiusValidated')} />
          <SecurityItem Icon={MapPinOff} title={t('mockGps')} value={t('flyGpsBlocked')} warning />
        </View>
        {showGpsRecovery ? (
          <View style={styles.gpsPanel}>
            <IconBadge Icon={Satellite} tone="warning" size={18} />
            <View style={styles.gpsCopy}>
              <Text style={styles.gpsTitle}>{t('gpsRequiredTitle')}</Text>
              <Text style={styles.gpsBody}>{t('gpsSettingsHint')}</Text>
            </View>
            <PrimaryButton compact icon={gpsIcon} mode="outlined" onPress={() => locationService.openLocationSettings()}>
              {t('enableGps')}
            </PrimaryButton>
          </View>
        ) : null}
        {requiresReason ? (
          <AppTextInput
            accessibilityLabel="Outside-office attendance reason"
            autoCapitalize="sentences"
            label="Reason for outside-office attendance"
            multiline
            onChangeText={setOutsideReason}
            value={outsideReason}
          />
        ) : null}
        {isCameraOpen ? (
          <PrimaryButton
            disabled={
              isSubmitting ||
              !isPreviewReady ||
              !hasPermission ||
              !device ||
              (requiresReason && outsideReason.trim().length < 3)
            }
            icon={captureIcon}
            loading={isSubmitting}
            onPress={captureAttendance}>
            {t('captureAndMarkAttendance')}
          </PrimaryButton>
        ) : (
          <PrimaryButton disabled={!device} icon={cameraIcon} onPress={openCamera}>
            {t('openCamera')}
          </PrimaryButton>
        )}
      </Card>
    </Screen>
  );
};

const SecurityItem = ({
  Icon,
  title,
  value,
  warning = false,
}: {
  Icon: React.ComponentProps<typeof IconBadge>['Icon'];
  title: string;
  value: string;
  warning?: boolean;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.securityItem}>
      <IconBadge Icon={Icon} tone={warning ? 'warning' : 'success'} size={16} />
      <View style={styles.securityCopy}>
        <Text style={styles.securityTitle}>{title}</Text>
        <Text style={styles.securityValue}>{value}</Text>
      </View>
    </View>
  );
};

const createStyles = (palette: AppColors) => StyleSheet.create({
  header: {
    gap: spacing.md,
  },
  headerText: {
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    color: palette.text,
  },
  subtitle: {
    ...typography.body,
    color: palette.textMuted,
  },
  cameraFrame: {
    backgroundColor: palette.primaryDark,
    borderRadius: 8,
    height: 340,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraFallback: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  fallbackText: {
    ...typography.caption,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  fallbackTitle: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  captureBadge: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderRadius: 8,
    bottom: spacing.lg,
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.lg,
    width: 48,
  },
  closeCameraButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(2, 20, 49, 0.78)',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    width: 48,
  },
  securityGrid: {
    gap: spacing.sm,
  },
  securityItem: {
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.md,
  },
  securityCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  securityTitle: {
    ...typography.body,
    color: palette.text,
    fontWeight: '700',
  },
  securityValue: {
    ...typography.caption,
    color: palette.textMuted,
  },
  gpsPanel: {
    alignItems: 'center',
    backgroundColor: palette.warningSoft,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  gpsCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  gpsTitle: {
    ...typography.body,
    color: palette.text,
    fontWeight: '700',
  },
  gpsBody: {
    ...typography.caption,
    color: palette.textMuted,
  },
});

export default AttendanceCaptureScreen;

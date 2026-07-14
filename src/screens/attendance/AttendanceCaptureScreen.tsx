import React, { useEffect, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import {
  Camera as CameraIcon,
  CheckCircle2,
  ChevronLeft,
  LocateFixed,
  MapPinOff,
  Satellite,
  ScanFace,
  X,
} from 'lucide-react-native';
import { Card } from '../../components/layout/Card';
import { IconBadge } from '../../components/layout/IconBadge';
import { Screen } from '../../components/layout/Screen';
import { PrimaryButton } from '../../components/forms/PrimaryButton';
import { RootStackParamList } from '../../navigation/types';
import { MOCK_LOCATION_MESSAGE } from '../../services/locationIntegrityService';
import { locationService } from '../../services/locationService';
import { permissionService } from '../../services/permissionService';
import { imageCompressionService } from '../../services/imageCompressionService';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { checkFaceEnrollment } from '../../store/slices/authSlice';
import { markAttendance } from '../../store/slices/attendanceSlice';
import { useTranslation } from '../../localization/useTranslation';
import { AppColors, colors } from '../../theme/colors';
import { useAppColors, useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const backIcon = () => <ChevronLeft color={colors.primary} size={18} />;
const captureIcon = () => <ScanFace color={colors.surface} size={18} />;
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
  const employeeId = useAppSelector(state => state.auth.session?.employee.id);
  const { t } = useTranslation();
  const device = useCameraDevice('front');
  const photoOutput = usePhotoOutput({ qualityPrioritization: 'quality' });
  const { canRequestPermission, hasPermission, requestPermission } = useCameraPermission();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGpsRecovery, setShowGpsRecovery] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

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
    if (message === 'ATTENDANCE_REASON_REQUIRED') {
      Alert.alert(
        'Reason required',
        'Your attendance policy allows this location only with a reason. Please contact HR to enable the outside-office approval flow.',
      );
      return;
    }
    if (message === 'ALREADY_CHECKED_IN') {
      Alert.alert('Already checked in', 'Your check-in is already recorded. Please use Check Out.');
      return;
    }
    if (message === 'CHECK_IN_REQUIRED') {
      Alert.alert('Check-in required', 'Please record a valid check-in before checking out.');
      return;
    }
    if (message === 'FACE_MISMATCH') {
      Alert.alert('Face mismatch', t('faceMismatch'));
      return;
    }
    if (message === 'FACE_NOT_REGISTERED') {
      Alert.alert('Face registration required', 'Please register your face before marking attendance.', [
        {
          text: t('done'),
          onPress: () => {
            if (employeeId) {
              dispatch(checkFaceEnrollment(employeeId));
            }
          },
        },
      ]);
      return;
    }
    if (
      message === 'FACE_MODEL_NOT_CONFIGURED' ||
      message === 'FACE_API_NOT_CONFIGURED' ||
      message === 'FACE_API_FAILED' ||
      message === 'FACE_QUALITY_REJECTED'
    ) {
      Alert.alert(t('faceModelRequiredTitle'), t('faceModelRequiredMessage'));
      return;
    }
    if (message === 'BIOMETRIC_NOT_ENROLLED') {
      Alert.alert(
        t('biometricRequired'),
        'Please configure biometric authentication in your phone settings.',
      );
      return;
    }
    if (message === 'BIOMETRIC_CANCELLED') {
      Alert.alert(t('biometricCancelled'), t('attendanceBiometricCancelled'));
      return;
    }

    Alert.alert(
      t('attendanceFailed'),
      t('attendanceFailedMessage'),
    );
  };

  const captureAttendance = async () => {
    if (!isCameraOpen || !hasPermission || !device) {
      return;
    }

    try {
      setIsSubmitting(true);

      const photo = await photoOutput.capturePhotoToFile(
        { flashMode: 'off', enableShutterSound: false },
        {},
      );
      const compressedImageRef = await imageCompressionService.compressSelfie(photo.filePath);
      setIsCameraOpen(false);

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

      await dispatch(
        markAttendance({
          attendanceType: route.params.attendanceType,
          imageRef: compressedImageRef,
          location,
        }),
      ).unwrap();

      Alert.alert(t('attendanceSaved'), t('attendanceSavedMessage'), [
        { text: t('done'), onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      showFailure(error);
    } finally {
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
            <Camera device={device} isActive outputs={[photoOutput]} style={styles.camera} />
          ) : (
            <View style={styles.cameraFallback}>
              <IconBadge Icon={CameraIcon} tone="primary" />
              <Text style={styles.fallbackTitle}>{t('cameraStandby')}</Text>
              <Text style={styles.fallbackText}>{t('cameraStandbyMessage')}</Text>
            </View>
          )}
          <View style={styles.captureBadge}>
            <ScanFace color={colors.surface} size={22} strokeWidth={2.4} />
          </View>
          {isCameraOpen ? (
            <Pressable
              accessibilityLabel={t('closeCamera')}
              accessibilityRole="button"
              onPress={() => setIsCameraOpen(false)}
              style={styles.closeCameraButton}>
              <X color={colors.surface} size={20} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.securityGrid}>
          <SecurityItem Icon={ScanFace} title={t('selfieAudit')} value={t('backendCanVerifyFace')} />
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
        {isCameraOpen ? (
          <PrimaryButton
            disabled={!hasPermission || !device}
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
  const themeColors = useAppColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.securityItem}>
      <IconBadge Icon={Icon} tone={warning ? 'warning' : 'success'} size={16} />
      <View style={styles.securityCopy}>
        <Text style={styles.securityTitle}>{title}</Text>
        <Text style={styles.securityValue}>{value}</Text>
      </View>
      {!warning ? <CheckCircle2 color={themeColors.success} size={16} /> : null}
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

import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
  Fingerprint,
  IdCard,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { Card } from '../../components/layout/Card';
import { IconBadge } from '../../components/layout/IconBadge';
import { Screen } from '../../components/layout/Screen';
import { PrimaryButton } from '../../components/forms/PrimaryButton';
import { RootStackParamList } from '../../navigation/types';
import {
  locationIntegrityService,
  MOCK_LOCATION_MESSAGE,
} from '../../services/locationIntegrityService';
import { imageCompressionService } from '../../services/imageCompressionService';
import { biometricService } from '../../services/biometricService';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { enrollFace, logout } from '../../store/slices/authSlice';
import { TranslationKey } from '../../localization/i18n';
import { useTranslation } from '../../localization/useTranslation';
import { FaceCaptureAngle, FaceRegistrationCapture } from '../../types/domain';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type CaptureStep = {
  angle: FaceCaptureAngle;
  labelKey: TranslationKey;
  titleKey: TranslationKey;
  instructionKey: TranslationKey;
  buttonKey: TranslationKey;
};

const faceCaptureSteps: CaptureStep[] = [
  {
    angle: 'FRONT',
    labelKey: 'frontFace',
    titleKey: 'frontFaceTitle',
    instructionKey: 'frontFaceInstruction',
    buttonKey: 'captureFrontPhoto',
  },
  {
    angle: 'LEFT',
    labelKey: 'leftFace',
    titleKey: 'leftFaceTitle',
    instructionKey: 'leftFaceInstruction',
    buttonKey: 'captureLeftPhoto',
  },
  {
    angle: 'RIGHT',
    labelKey: 'rightFace',
    titleKey: 'rightFaceTitle',
    instructionKey: 'rightFaceInstruction',
    buttonKey: 'captureRightPhoto',
  },
];

const captureIcon = () => <ScanFace color={colors.surface} size={18} />;
const submitIcon = () => <ShieldCheck color={colors.surface} size={18} />;
const cameraIcon = () => <CameraIcon color={colors.surface} size={18} />;
const backIcon = () => <ChevronLeft color={colors.primary} size={18} />;

const imageUri = (imageRef: string) =>
  imageRef.startsWith('file://') ? imageRef : `file://${imageRef}`;

const FaceEnrollmentScreen = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const employee = useAppSelector(state => state.auth.session?.employee);
  const { t } = useTranslation();
  const device = useCameraDevice('front');
  const photoOutput = usePhotoOutput({ qualityPrioritization: 'quality' });
  const { canRequestPermission, hasPermission, requestPermission } = useCameraPermission();
  const [captures, setCaptures] = useState<FaceRegistrationCapture[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const capturesByAngle = useMemo(
    () => new Map(captures.map(capture => [capture.angle, capture])),
    [captures],
  );
  const currentStep = faceCaptureSteps.find(step => !capturesByAngle.has(step.angle));
  const currentStepIndex = currentStep
    ? faceCaptureSteps.findIndex(step => step.angle === currentStep.angle)
    : faceCaptureSteps.length;
  const isCaptureSetComplete = captures.length === faceCaptureSteps.length;

  const orderedCaptures = useMemo(
    () =>
      faceCaptureSteps
        .map(step => capturesByAngle.get(step.angle))
        .filter((capture): capture is FaceRegistrationCapture => Boolean(capture)),
    [capturesByAngle],
  );

  const showError = (error: unknown) => {
    if (error instanceof Error && error.message === 'MOCK_LOCATION_DETECTED') {
      Alert.alert('Mock location blocked', MOCK_LOCATION_MESSAGE);
      return;
    }
    if (error instanceof Error && error.message === 'LOCATION_SECURITY_REQUIRED') {
      Alert.alert(t('locationIntegrityRequired'), 'Please allow precise location before biometric registration.');
      return;
    }
    if (error instanceof Error && error.message === 'BIOMETRIC_NOT_ENROLLED') {
      Alert.alert(t('biometricRequired'), t('biometricRequiredLoginMessage'));
      return;
    }
    if (error instanceof Error && error.message === 'BIOMETRIC_CANCELLED') {
      Alert.alert(t('loginFailed'), t('passwordBiometricRequired'));
      return;
    }
    if (error instanceof Error && error.message === 'FACE_QUALITY_REJECTED') {
      Alert.alert(t('faceQualityRejected'), t('faceQualityRejectedMessage'));
      return;
    }
    if (error instanceof Error && error.message === 'FACE_ENROLLMENT_NETWORK_FAILED') {
      Alert.alert(t('networkUnavailable'), t('faceEnrollmentNetworkMessage'));
      return;
    }
    Alert.alert(t('registrationFailed'), t('registrationFailedMessage'));
  };

  const captureCurrentAngle = async () => {
    if (!currentStep || !device || !isCameraOpen) {
      return;
    }

    try {
      setIsCapturing(true);
      const photo = await photoOutput.capturePhotoToFile(
        { flashMode: 'off', enableShutterSound: false },
        {},
      );
      const compressedImageRef = await imageCompressionService.compressEnrollmentSelfie(
        photo.filePath,
      );
      setCaptures(previousCaptures => [
        ...previousCaptures.filter(capture => capture.angle !== currentStep.angle),
        {
          angle: currentStep.angle,
          imageRef: compressedImageRef,
          capturedAt: new Date().toISOString(),
        },
      ]);
      setIsCameraOpen(false);
    } catch (error) {
      showError(error);
    } finally {
      setIsCapturing(false);
    }
  };

  const retakeCapture = (angle: FaceCaptureAngle) => {
    setIsCameraOpen(false);
    setCaptures(previousCaptures => previousCaptures.filter(capture => capture.angle !== angle));
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

  const leaveRegistration = () => {
    setIsCameraOpen(false);
    navigation.goBack();
  };

  const submitRegistration = async () => {
    if (!employee) {
      Alert.alert(t('sessionExpired'), t('sessionExpired'));
      dispatch(logout());
      return;
    }

    if (!isCaptureSetComplete) {
      Alert.alert(t('faceCaptureIncomplete'), t('faceCaptureIncompleteMessage'));
      return;
    }

    try {
      setIsRegistering(true);
      await locationIntegrityService.assertTrustedLoginLocation();
      await biometricService.authenticateForRegistration();
      await dispatch(
        enrollFace({
          employeeId: employee.id,
          captures: orderedCaptures,
        }),
      ).unwrap();
      Alert.alert(t('faceRegistered'), t('faceRegisteredMessage'), [
        { text: t('done'), onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      showError(error);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <Screen>
      <View style={styles.topAction}>
        <PrimaryButton compact icon={backIcon} mode="outlined" onPress={leaveRegistration}>
          {t('back')}
        </PrimaryButton>
      </View>
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <IdCard color={colors.surface} size={26} strokeWidth={2.3} />
        </View>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('faceEnrollmentTitle')}
          </Text>
          <Text style={styles.subtitle}>{t('faceEnrollmentSubtitle')}</Text>
        </View>
      </View>
      <Card>
        <View style={styles.employeeRow}>
          <IconBadge Icon={ShieldCheck} tone="success" />
          <View style={styles.employeeCopy}>
            <Text style={styles.employeeName}>{employee?.name}</Text>
            <Text style={styles.employeeMeta}>
              {employee?.id} - {employee?.department}
            </Text>
          </View>
        </View>

        <View style={styles.progressRow}>
          {faceCaptureSteps.map((step, index) => {
            const isDone = capturesByAngle.has(step.angle);
            const isActive = currentStep?.angle === step.angle;
            return (
              <View
                accessibilityLabel={t(step.labelKey)}
                key={step.angle}
                style={[
                  styles.stepPill,
                  isActive ? styles.stepPillActive : undefined,
                  isDone ? styles.stepPillDone : undefined,
                ]}>
                <View style={[styles.stepIcon, isDone ? styles.stepIconDone : undefined]}>
                  {isDone ? (
                    <CheckCircle2 color={colors.success} size={15} strokeWidth={2.5} />
                  ) : (
                    <Text style={styles.stepNumber}>{index + 1}</Text>
                  )}
                </View>
                <Text style={[styles.stepText, isDone ? styles.stepTextDone : undefined]}>
                  {t(step.labelKey)}
                </Text>
              </View>
            );
          })}
        </View>

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
          {isCameraOpen ? <View style={styles.cameraScrim} /> : null}
          <View style={styles.cameraInstructionPanel}>
            <Text style={styles.stepCounter}>
              {isCaptureSetComplete
                ? t('faceCaptureReady')
                : `${currentStepIndex + 1}/${faceCaptureSteps.length}`}
            </Text>
            <Text style={styles.cameraTitle}>
              {currentStep ? t(currentStep.titleKey) : t('allAnglesCaptured')}
            </Text>
            <Text style={styles.cameraInstruction}>
              {currentStep ? t(currentStep.instructionKey) : t('faceCaptureReadyMessage')}
            </Text>
          </View>
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

        <View style={styles.previewRow}>
          {faceCaptureSteps.map(step => {
            const capture = capturesByAngle.get(step.angle);
            return (
              <View key={step.angle} style={styles.previewCard}>
                {capture ? (
                  <Image source={{ uri: imageUri(capture.imageRef) }} style={styles.previewImage} />
                ) : (
                  <View style={styles.previewPlaceholder}>
                    <ScanFace color={colors.textMuted} size={20} />
                  </View>
                )}
                <View style={styles.previewFooter}>
                  <Text style={styles.previewLabel}>{t(step.labelKey)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!capture}
                    onPress={() => retakeCapture(step.angle)}
                    style={[styles.retakeButton, !capture ? styles.retakeButtonDisabled : undefined]}>
                    <RotateCcw color={capture ? colors.primary : colors.textMuted} size={15} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.policyBox}>
          <Text style={styles.policyTitle}>{t('securityPolicy')}</Text>
          <Text style={styles.policyText}>{t('faceEnrollmentPolicy')}</Text>
        </View>
        <View style={styles.biometricRow}>
          <IconBadge Icon={Fingerprint} tone="primary" size={16} />
          <Text style={styles.biometricText}>{t('biometricEnrollmentNote')}</Text>
        </View>

        {isCaptureSetComplete ? (
          <PrimaryButton
            icon={submitIcon}
            loading={isRegistering}
            onPress={submitRegistration}>
            {t('submitFaceRegistration')}
          </PrimaryButton>
        ) : isCameraOpen ? (
          <PrimaryButton
            disabled={!hasPermission || !device}
            icon={captureIcon}
            loading={isCapturing}
            onPress={captureCurrentAngle}>
            {currentStep ? t(currentStep.buttonKey) : t('captureSelfie')}
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

const styles = StyleSheet.create({
  topAction: {
    alignItems: 'flex-start',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  employeeRow: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  employeeCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  employeeName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  employeeMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  progressRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepPill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minHeight: 72,
    padding: spacing.sm,
  },
  stepPillActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  stepPillDone: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  stepIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  stepIconDone: {
    backgroundColor: colors.surface,
  },
  stepNumber: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '800',
  },
  stepText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    textAlign: 'center',
  },
  stepTextDone: {
    color: colors.text,
  },
  cameraFrame: {
    backgroundColor: colors.primaryDark,
    borderRadius: 8,
    height: 360,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraScrim: {
    backgroundColor: 'rgba(2, 20, 49, 0.18)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
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
    color: colors.surface,
    textAlign: 'center',
  },
  fallbackTitle: {
    ...typography.body,
    color: colors.surface,
    fontWeight: '700',
    textAlign: 'center',
  },
  cameraInstructionPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 8,
    bottom: spacing.md,
    gap: spacing.xs,
    left: spacing.md,
    padding: spacing.md,
    position: 'absolute',
    right: 76,
  },
  stepCounter: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cameraTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '800',
  },
  cameraInstruction: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  captureBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    bottom: spacing.md,
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.md,
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
  previewRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  previewCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
  },
  previewImage: {
    aspectRatio: 1,
    width: '100%',
  },
  previewPlaceholder: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    width: '100%',
  },
  previewFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 42,
    paddingHorizontal: spacing.sm,
  },
  previewLabel: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
    fontWeight: '700',
  },
  retakeButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  retakeButtonDisabled: {
    opacity: 0.35,
  },
  policyBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    gap: spacing.xs,
    padding: spacing.md,
  },
  policyTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  policyText: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 19,
  },
  biometricRow: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
    padding: spacing.md,
  },
  biometricText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
    lineHeight: 19,
  },
});

export default FaceEnrollmentScreen;

import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Fingerprint, ScanFace, ShieldCheck } from 'lucide-react-native';
import { Card } from '../../components/layout/Card';
import { IconBadge } from '../../components/layout/IconBadge';
import { Screen } from '../../components/layout/Screen';
import { PrimaryButton } from '../../components/forms/PrimaryButton';
import { AppTextInput } from '../../components/forms/AppTextInput';
import { RootStackParamList } from '../../navigation/types';
import { biometricService } from '../../services/biometricService';
import { faceEnrollmentService } from '../../services/faceEnrollmentService';
import {
  locationIntegrityService,
  MOCK_LOCATION_MESSAGE,
} from '../../services/locationIntegrityService';
import { useAppDispatch } from '../../store/hooks';
import { login } from '../../store/slices/authSlice';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useTranslation } from '../../localization/useTranslation';
import { isValidEmployeeIdentifier } from '../../validators/authValidators';

const backIcon = () => <ChevronLeft color={colors.primary} size={18} />;
const biometricIcon = () => <Fingerprint color={colors.surface} size={18} />;

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

const FaceLoginScreen = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const [employeeId, setEmployeeId] = useState('EMP-1024');
  const [isVerifying, setIsVerifying] = useState(false);

  const showError = (error: unknown) => {
    const message = getErrorMessage(error);
    if (message === 'MOCK_LOCATION_DETECTED') {
      Alert.alert('Mock location blocked', MOCK_LOCATION_MESSAGE);
      return;
    }
    if (message === 'LOCATION_SECURITY_REQUIRED') {
      Alert.alert(t('locationIntegrityRequired'), 'Please allow precise location before biometric login.');
      return;
    }
    if (message === 'FACE_NOT_REGISTERED') {
      Alert.alert(t('registrationRequired'), t('registrationRequiredMessage'));
      return;
    }
    if (message === 'BIOMETRIC_NOT_ENROLLED') {
      Alert.alert(t('biometricRequired'), t('biometricRequiredLoginMessage'));
      return;
    }
    if (message === 'BIOMETRIC_CANCELLED') {
      Alert.alert(t('loginFailed'), t('passwordBiometricRequired'));
      return;
    }
    Alert.alert(t('biometricLoginFailed'), t('biometricLoginFailedMessage'));
  };

  const authenticateAndLogin = async () => {
    try {
      setIsVerifying(true);
      const normalizedEmployeeId = employeeId.trim().toUpperCase();
      if (!isValidEmployeeIdentifier(normalizedEmployeeId)) {
        Alert.alert(t('invalidLogin'), t('invalidLoginMessage'));
        return;
      }

      await locationIntegrityService.assertTrustedLoginLocation();
      const isRegistered = await faceEnrollmentService.getStatus(normalizedEmployeeId);
      if (!isRegistered) {
        throw new Error('FACE_NOT_REGISTERED');
      }

      await biometricService.authenticateForLogin();
      await dispatch(
        login({ identifier: normalizedEmployeeId, password: `biometric-login-${Date.now()}` }),
      ).unwrap();
    } catch (error) {
      showError(error);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <PrimaryButton icon={backIcon} mode="outlined" onPress={() => navigation.goBack()}>
          {t('back')}
        </PrimaryButton>
        <View style={styles.headerText}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('faceLoginTitle')}
          </Text>
          <Text style={styles.subtitle}>
            {t('faceLoginSubtitle')}
          </Text>
        </View>
      </View>
      <Card>
        <AppTextInput
          accessibilityLabel={t('employeeId')}
          autoCapitalize="characters"
          label={t('employeeId')}
          onChangeText={setEmployeeId}
          value={employeeId}
        />
        <View style={styles.biometricPanel}>
          <View style={styles.faceMark}>
            <ScanFace color={colors.surface} size={34} strokeWidth={2.3} />
          </View>
          <Text style={styles.panelTitle}>{t('osBiometricAuthentication')}</Text>
          <Text style={styles.panelText}>{t('biometricLoginPanel')}</Text>
        </View>
        <View style={styles.securityRow}>
          <IconBadge Icon={ShieldCheck} tone="success" size={18} />
          <View style={styles.securityTextWrap}>
            <Text style={styles.securityTitle}>{t('noPhotoMatching')}</Text>
            <Text style={styles.securityCopy}>{t('noPhotoMatchingCopy')}</Text>
          </View>
        </View>
        <PrimaryButton icon={biometricIcon} loading={isVerifying} onPress={authenticateAndLogin}>
          {t('authenticateAndLogin')}
        </PrimaryButton>
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    gap: spacing.md,
  },
  headerText: {
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
  biometricPanel: {
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: 8,
    gap: spacing.md,
    minHeight: 240,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  faceMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  panelTitle: {
    ...typography.sectionTitle,
    color: colors.surface,
    textAlign: 'center',
  },
  panelText: {
    ...typography.body,
    color: '#DCE8FF',
    textAlign: 'center',
  },
  securityRow: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  securityTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  securityTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  securityCopy: {
    ...typography.caption,
    color: colors.textMuted,
  },
});

export default FaceLoginScreen;

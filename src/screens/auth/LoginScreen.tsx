import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Image, StyleSheet, Text, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import {
  ChevronLeft,
  Eye,
  EyeOff,
  Fingerprint,
  LogIn,
  MapPin,
} from 'lucide-react-native';
import { TextInput } from 'react-native-paper';
import { clientLogos } from '../../assets/clientLogos';
import { Card } from '../../components/layout/Card';
import { ClientLogo } from '../../components/layout/ClientLogo';
import { Screen } from '../../components/layout/Screen';
import { AppTextInput } from '../../components/forms/AppTextInput';
import { PrimaryButton } from '../../components/forms/PrimaryButton';
import { biometricService } from '../../services/biometricService';
import { credentialStorageService } from '../../services/credentialStorageService';
import { deviceRegistrationService } from '../../services/deviceRegistrationService';
import { locationIntegrityService, MOCK_LOCATION_MESSAGE } from '../../services/locationIntegrityService';
import { locationService } from '../../services/locationService';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { clearClientSelection } from '../../store/slices/clientSlice';
import { login, loginWithBiometric } from '../../store/slices/authSlice';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useTranslation } from '../../localization/useTranslation';
import { isValidEmployeeIdentifier, isValidPassword } from '../../validators/authValidators';
import { getErrorMessage } from '../../utils/errorMessage';

type FormValues = {
  email: string;
  password: string;
};

const signInIcon = () => <LogIn color={colors.surface} size={18} />;
const biometricIcon = () => <Fingerprint color={colors.primary} size={18} />;
const showPasswordIcon = () => <Eye color={colors.textMuted} size={18} />;
const hidePasswordIcon = () => <EyeOff color={colors.textMuted} size={18} />;
const locationIcon = () => <MapPin color={colors.primary} size={18} />;
const backIcon = () => <ChevronLeft color={colors.primary} size={18} />;

const LoginScreen = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const selectedClient = useAppSelector(state => state.client.selectedClient);
  const [isCheckingSecurity, setIsCheckingSecurity] = useState(false);
  const [isBiometricLoginReady, setIsBiometricLoginReady] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [showGpsAction, setShowGpsAction] = useState(false);
  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    setIsBiometricLoginReady(
      selectedClient ? deviceRegistrationService.isBiometricLoginReady(selectedClient.code) : false,
    );
  }, [selectedClient]);

  useEffect(() => {
    let isCancelled = false;

    if (!selectedClient) {
      reset({ email: '', password: '' });
      return undefined;
    }

    credentialStorageService
      .load(selectedClient.code)
      .then(credentials => {
        if (isCancelled) {
          return;
        }
        if (credentials) {
          reset(credentials);
          return;
        }
        reset({ email: '', password: '' });
      })
      .catch(() => {
        if (!isCancelled) {
          reset({ email: '', password: '' });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [reset, selectedClient]);

  const refreshGpsAction = useCallback(async () => {
    try {
      await locationService.getCurrentPosition();
      setShowGpsAction(false);
    } catch (error) {
      setShowGpsAction(locationService.isLocationSettingsDisabledError(error));
    }
  }, []);

  useEffect(() => {
    refreshGpsAction();
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        refreshGpsAction();
      }
    });

    return () => subscription.remove();
  }, [refreshGpsAction]);

  const showSecurityError = (error: unknown) => {
    const message = getErrorMessage(error);
    if (message === 'MOCK_LOCATION_DETECTED') {
      Alert.alert('Mock location blocked', MOCK_LOCATION_MESSAGE);
      return;
    }
    if (message === 'LOCATION_SECURITY_REQUIRED') {
      Alert.alert(t('securityCheckFailed'), t('securityCheckFailedMessage'));
      return;
    }
    if (message === 'LOCATION_PERMISSION_REQUIRED') {
      Alert.alert(t('locationPermissionDenied'), t('locationPermissionAttendance'));
      return;
    }
    if (message === 'LOCATION_SETTINGS_DISABLED') {
      setShowGpsAction(true);
      Alert.alert(t('gpsRequiredTitle'), t('gpsRequiredMessage'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('enableGps'), onPress: () => locationService.openLocationSettings() },
      ]);
      return;
    }
    if (message === 'DEVICE_REGISTRATION_MISMATCH') {
      Alert.alert(
        t('loginFailed'),
        'This profile is already registered with another employee/device on this app. Please contact your HR.',
      );
      return;
    }
    if (message === 'BIOMETRIC_LOGIN_NOT_REGISTERED') {
      Alert.alert(t('biometricLoginFailed'), t('biometricLoginNotRegistered'));
      return;
    }
    if (message === 'BIOMETRIC_NOT_ENROLLED') {
      Alert.alert(t('biometricRequired'), t('biometricRequiredLoginMessage'));
      return;
    }
    if (message === 'BIOMETRIC_CANCELLED') {
      Alert.alert(t('biometricCancelled'), t('biometricLoginFailedMessage'));
      return;
    }
    if (message === 'SESSION_SECURE_STORAGE_FAILED') {
      Alert.alert(
        'Secure storage unavailable',
        'Unlock the phone, restart the app, and try again. The app could not safely store your login session.',
      );
      return;
    }
    if (
      message === 'INVALID_LOGIN' ||
      message === 'LOGIN_FIELDS_REQUIRED' ||
      message === 'API_LOGIN_TOKEN_MISSING'
    ) {
      Alert.alert(t('loginFailed'), t('invalidLoginMessage'));
      return;
    }
    if (message === 'LOGIN_RATE_LIMITED') {
      Alert.alert(
        'Too many login attempts',
        'Please wait one minute before trying to sign in again.',
      );
      return;
    }
    if (message === 'NETWORK_UNAVAILABLE') {
      Alert.alert(t('networkUnavailable'), t('networkUnavailableMessage'));
      return;
    }
    if (message === 'REQUEST_TIMEOUT') {
      Alert.alert(t('requestTimedOut'), t('requestTimedOutMessage'));
      return;
    }
    if (
      message === 'SERVER_UNAVAILABLE' || message === 'LOGIN_ACCESS_DENIED'
    ) {
      Alert.alert(t('serverUnavailable'), t('serverUnavailableMessage'));
      return;
    }
    if (
      message === 'LOGIN_CLIENT_REQUIRED' ||
      message === 'LOGIN_EMPLOYEE_REQUIRED' ||
      message === 'LOGIN_ESS_PERMISSION_REQUIRED' ||
      message === 'ESS_IDENTITY_REQUIRED' ||
      message === 'ESS_ACCESS_REQUIRED' ||
      message === 'ESS_ACCOUNT_INACTIVE' ||
      message === 'ESS_PROFILE_REQUIRED'
    ) {
      Alert.alert(
        t('loginFailed'),
        'This account is not linked to an active employee profile with mobile ESS access. Please contact HR.',
      );
      return;
    }
    if (message === 'PASSWORD_CHANGE_REQUIRED') {
      Alert.alert(
        t('loginFailed'),
        'Your password must be changed before mobile ESS can be used. Please change it in the HRMS web portal or contact HR.',
      );
      return;
    }
    Alert.alert(t('loginFailed'), t('unexpectedLoginError'));
  };

  const withTrustedLocation = async (next: () => Promise<void>) => {
    try {
      setIsCheckingSecurity(true);
      await locationIntegrityService.assertTrustedLoginLocation();
      await next();
    } catch (error) {
      showSecurityError(error);
    } finally {
      setIsCheckingSecurity(false);
    }
  };

  const onSubmit = (values: FormValues) => {
    if (!isValidEmployeeIdentifier(values.email) || !isValidPassword(values.password)) {
      Alert.alert(t('invalidLogin'), t('invalidLoginMessage'));
      return;
    }
    withTrustedLocation(async () => {
      await dispatch(login({ identifier: values.email.trim(), password: values.password })).unwrap();
      if (selectedClient) {
        try {
          await credentialStorageService.save(selectedClient.code, {
            email: values.email.trim(),
            password: values.password,
          });
        } catch {
          // Credential persistence must never invalidate a successful HRMS login.
        }
      }
    });
  };

  const onBiometricLogin = () => {
    withTrustedLocation(async () => {
      await biometricService.authenticateForLogin();
      await dispatch(loginWithBiometric()).unwrap();
    });
  };

  const onChangeClient = () => {
    dispatch(clearClientSelection());
  };

  return (
    <Screen>
      <View style={styles.topAction}>
        <PrimaryButton compact icon={backIcon} mode="outlined" onPress={onChangeClient}>
          {t('backToClientCode')}
        </PrimaryButton>
      </View>
      <View style={styles.brandHeader}>
        <Image
          accessibilityLabel="Frevone logo"
          resizeMode="cover"
          source={clientLogos.frevone}
          style={styles.frevoneLogo}
        />
        <Text accessibilityRole="header" style={styles.signInTitle}>
          {t('signIn')}
        </Text>
      </View>
      <Card>
        {selectedClient ? (
          <View style={styles.clientPanel}>
            <ClientLogo branding={selectedClient.branding} size="lg" wide />
            <View style={styles.clientCopy}>
              <Text style={styles.clientLabel}>{t('selectedClient')}</Text>
              <Text style={styles.clientName}>{selectedClient.name}</Text>
              <Text style={styles.clientCode}>{selectedClient.code}</Text>
            </View>
          </View>
        ) : null}
        {showGpsAction ? (
          <PrimaryButton
            compact
            icon={locationIcon}
            mode="outlined"
            onPress={() => locationService.openLocationSettings()}>
            {t('openGpsSettings')}
          </PrimaryButton>
        ) : null}
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <AppTextInput
              accessibilityLabel={t('username')}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect={false}
              importantForAutofill="yes"
              label={t('username')}
              onChangeText={onChange}
              returnKeyType="next"
              textContentType="username"
              value={value}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <AppTextInput
              accessibilityLabel={t('password')}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect={false}
              importantForAutofill="yes"
              label={t('password')}
              onChangeText={onChange}
              right={
                <TextInput.Icon
                  accessibilityLabel={isPasswordVisible ? t('hidePassword') : t('showPassword')}
                  forceTextInputFocus={false}
                  icon={isPasswordVisible ? hidePasswordIcon : showPasswordIcon}
                  onPress={() => setIsPasswordVisible(current => !current)}
                />
              }
              returnKeyType="done"
              secureTextEntry={!isPasswordVisible}
              textContentType="password"
              value={value}
            />
          )}
        />
        <PrimaryButton icon={signInIcon} loading={isCheckingSecurity} onPress={handleSubmit(onSubmit)}>
          {t('signIn')}
        </PrimaryButton>
        {isBiometricLoginReady ? (
          <PrimaryButton
            icon={biometricIcon}
            loading={isCheckingSecurity}
            mode="outlined"
            onPress={onBiometricLogin}>
            {t('loginWithBiometric')}
          </PrimaryButton>
        ) : null}
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  topAction: {
    alignItems: 'flex-start',
  },
  brandHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  frevoneLogo: {
    backgroundColor: colors.surface,
    height: 92,
    width: 230,
  },
  signInTitle: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  clientPanel: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  clientCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  clientLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  clientName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  clientCode: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
});

export default LoginScreen;

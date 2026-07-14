import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import {
  Building2,
  ChevronLeft,
  Eye,
  EyeOff,
  Fingerprint,
  LogIn,
  MapPin,
  MapPinOff,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';
import { Checkbox, TextInput } from 'react-native-paper';
import { Card } from '../../components/layout/Card';
import { ClientLogo } from '../../components/layout/ClientLogo';
import { IconBadge } from '../../components/layout/IconBadge';
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
import { isValidEmail, isValidPassword } from '../../validators/authValidators';

type FormValues = {
  email: string;
  password: string;
};

const signInIcon = () => <LogIn color={colors.surface} size={18} />;
const changeClientIcon = () => <RefreshCw color={colors.primary} size={18} />;
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
  const [isRemembered, setIsRemembered] = useState(false);
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
      setIsRemembered(false);
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
          setIsRemembered(true);
          return;
        }
        reset({ email: '', password: '' });
        setIsRemembered(false);
      })
      .catch(() => {
        if (!isCancelled) {
          setIsRemembered(false);
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
    if (error instanceof Error && error.message === 'MOCK_LOCATION_DETECTED') {
      Alert.alert('Mock location blocked', MOCK_LOCATION_MESSAGE);
      return;
    }
    if (error instanceof Error && error.message === 'LOCATION_SECURITY_REQUIRED') {
      Alert.alert(t('securityCheckFailed'), t('securityCheckFailedMessage'));
      return;
    }
    if (error instanceof Error && error.message === 'LOCATION_PERMISSION_REQUIRED') {
      Alert.alert(t('locationPermissionDenied'), t('locationPermissionAttendance'));
      return;
    }
    if (error instanceof Error && error.message === 'LOCATION_SETTINGS_DISABLED') {
      setShowGpsAction(true);
      Alert.alert(t('gpsRequiredTitle'), t('gpsRequiredMessage'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('enableGps'), onPress: () => locationService.openLocationSettings() },
      ]);
      return;
    }
    if (error instanceof Error && error.message === 'DEVICE_REGISTRATION_MISMATCH') {
      Alert.alert(
        t('loginFailed'),
        'This profile is already registered with another employee/device on this app. Please contact your HR.',
      );
      return;
    }
    if (error instanceof Error && error.message === 'BIOMETRIC_LOGIN_NOT_REGISTERED') {
      Alert.alert(t('biometricLoginFailed'), t('biometricLoginNotRegistered'));
      return;
    }
    if (error instanceof Error && error.message === 'BIOMETRIC_NOT_ENROLLED') {
      Alert.alert(t('biometricRequired'), t('biometricRequiredLoginMessage'));
      return;
    }
    if (error instanceof Error && error.message === 'BIOMETRIC_CANCELLED') {
      Alert.alert(t('biometricCancelled'), t('biometricLoginFailedMessage'));
      return;
    }
    if (
      error instanceof Error &&
      (error.message === 'INVALID_LOGIN' || error.message === 'API_LOGIN_TOKEN_MISSING')
    ) {
      Alert.alert(t('loginFailed'), t('invalidLoginMessage'));
      return;
    }
    if (error instanceof Error && error.message === 'NETWORK_UNAVAILABLE') {
      Alert.alert(t('networkUnavailable'), t('networkUnavailableMessage'));
      return;
    }
    if (error instanceof Error && error.message === 'REQUEST_TIMEOUT') {
      Alert.alert(t('requestTimedOut'), t('requestTimedOutMessage'));
      return;
    }
    if (
      error instanceof Error &&
      (error.message === 'SERVER_UNAVAILABLE' || error.message === 'LOGIN_ACCESS_DENIED')
    ) {
      Alert.alert(t('serverUnavailable'), t('serverUnavailableMessage'));
      return;
    }
    if (
      error instanceof Error &&
      (error.message === 'CLIENT_AUTH_MISMATCH' ||
        error.message === 'USER_CLIENT_NOT_ASSIGNED' ||
        error.message === 'INVALID_CLIENT_CODE')
    ) {
      Alert.alert(
        t('loginFailed'),
        'This account does not belong to the selected client code. Please verify the code or contact HR.',
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
    if (!isValidEmail(values.email) || !isValidPassword(values.password)) {
      Alert.alert(t('invalidLogin'), t('invalidLoginMessage'));
      return;
    }
    withTrustedLocation(async () => {
      await dispatch(login({ identifier: values.email.trim(), password: values.password })).unwrap();
      if (selectedClient) {
        try {
          if (isRemembered) {
            await credentialStorageService.save(selectedClient.code, {
              email: values.email.trim(),
              password: values.password,
            });
          } else {
            await credentialStorageService.clear(selectedClient.code);
          }
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

  const toggleRememberMe = () => {
    const nextValue = !isRemembered;
    setIsRemembered(nextValue);
    if (!nextValue && selectedClient) {
      credentialStorageService.clear(selectedClient.code).catch(() => undefined);
    }
  };

  return (
    <Screen>
      <View style={styles.topAction}>
        <PrimaryButton compact icon={backIcon} mode="outlined" onPress={onChangeClient}>
          {t('backToClientCode')}
        </PrimaryButton>
      </View>
      <View style={styles.brandPanel}>
        <View style={styles.brandTop}>
          <View style={styles.logoMark}>
            <Building2 color={colors.surface} size={28} strokeWidth={2.3} />
          </View>
          <View style={styles.securityPill}>
            <ShieldCheck color={colors.success} size={16} strokeWidth={2.4} />
            <Text style={styles.securityText}>{t('secureHrms')}</Text>
          </View>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {t('loginTitle')}
        </Text>
        <Text style={styles.subtitle}>{t('loginSubtitle')}</Text>
      </View>
      <Card>
        {selectedClient ? (
          <View style={styles.clientPanel}>
            <ClientLogo branding={selectedClient.branding} size="sm" />
            <View style={styles.clientCopy}>
              <Text style={styles.clientLabel}>{t('selectedClient')}</Text>
              <Text style={styles.clientName}>{selectedClient.name}</Text>
              <Text style={styles.clientCode}>{selectedClient.code}</Text>
            </View>
            <PrimaryButton compact icon={changeClientIcon} mode="outlined" onPress={onChangeClient}>
              {t('changeClient')}
            </PrimaryButton>
          </View>
        ) : null}
        <View style={styles.notice}>
          <IconBadge Icon={MapPinOff} tone="warning" size={18} />
          <View style={styles.noticeTextWrap}>
            <Text style={styles.noticeTitle}>{t('locationIntegrityRequired')}</Text>
            <Text style={styles.noticeBody}>{t('mockLocationBlockedBeforeLogin')}</Text>
          </View>
        </View>
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
              accessibilityLabel={t('emailAddress')}
              autoComplete="email"
              autoCapitalize="none"
              importantForAutofill="yes"
              keyboardType="email-address"
              label={t('emailAddress')}
              onChangeText={onChange}
              returnKeyType="next"
              textContentType="emailAddress"
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
        <Pressable
          accessibilityLabel={t('rememberMe')}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isRemembered }}
          onPress={toggleRememberMe}
          style={styles.rememberRow}>
          <Checkbox.Android
            color={colors.primary}
            onPress={toggleRememberMe}
            status={isRemembered ? 'checked' : 'unchecked'}
          />
          <View style={styles.rememberCopy}>
            <Text style={styles.rememberTitle}>{t('rememberMe')}</Text>
            <Text style={styles.rememberHint}>{t('credentialsStoredSecurely')}</Text>
          </View>
        </Pressable>
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
  brandPanel: {
    backgroundColor: colors.primaryDark,
    borderRadius: 8,
    gap: spacing.md,
    overflow: 'hidden',
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  brandTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 8,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  securityPill: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  securityText: {
    ...typography.caption,
    color: colors.text,
  },
  title: {
    ...typography.title,
    color: colors.surface,
  },
  subtitle: {
    ...typography.body,
    color: '#DCE8FF',
  },
  notice: {
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  noticeTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  noticeTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  noticeBody: {
    ...typography.caption,
    color: colors.textMuted,
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
  rememberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 48,
  },
  rememberCopy: {
    flex: 1,
    gap: 2,
  },
  rememberTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  rememberHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
});

export default LoginScreen;

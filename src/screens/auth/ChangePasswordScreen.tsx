import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { Eye, EyeOff, KeyRound, LogOut } from 'lucide-react-native';
import { TextInput } from 'react-native-paper';
import { AppTextInput } from '../../components/forms/AppTextInput';
import { PrimaryButton } from '../../components/forms/PrimaryButton';
import { Card } from '../../components/layout/Card';
import { Screen } from '../../components/layout/Screen';
import { credentialStorageService } from '../../services/credentialStorageService';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { changePassword, logout } from '../../store/slices/authSlice';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { getErrorMessage } from '../../utils/errorMessage';

type FormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const changeIcon = () => <KeyRound color={colors.surface} size={18} />;
const logoutIcon = () => <LogOut color={colors.primary} size={18} />;
const showPasswordIcon = () => <Eye color={colors.textMuted} size={18} />;
const hidePasswordIcon = () => <EyeOff color={colors.textMuted} size={18} />;

const ChangePasswordScreen = () => {
  const dispatch = useAppDispatch();
  const session = useAppSelector(state => state.auth.session);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibleField, setVisibleField] = useState<keyof FormValues>();
  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const showFailure = (error: unknown) => {
    const message = getErrorMessage(error);
    if (message === 'CURRENT_PASSWORD_INVALID') {
      Alert.alert('Password not changed', 'Your current password is incorrect.');
      return;
    }
    if (message === 'NEW_PASSWORD_TOO_SHORT') {
      Alert.alert('Password not changed', 'New password must contain at least 8 characters.');
      return;
    }
    if (message === 'NETWORK_UNAVAILABLE' || message === 'REQUEST_TIMEOUT') {
      Alert.alert('Connection required', 'Connect to the internet and try again.');
      return;
    }
    if (message === 'SESSION_EXPIRED') {
      Alert.alert('Session expired', 'Sign in again with your temporary password.');
      dispatch(logout());
      return;
    }
    Alert.alert('Password not changed', 'The password could not be changed. Please try again.');
  };

  const onSubmit = async (values: FormValues) => {
    if (!values.currentPassword) {
      Alert.alert('Current password required', 'Enter the temporary password used to sign in.');
      return;
    }
    if (values.newPassword.length < 8) {
      Alert.alert('New password required', 'New password must contain at least 8 characters.');
      return;
    }
    if (values.newPassword === values.currentPassword) {
      Alert.alert('Choose a new password', 'New password must be different from the current password.');
      return;
    }
    if (values.newPassword !== values.confirmPassword) {
      Alert.alert('Passwords do not match', 'Re-enter the same new password in both fields.');
      return;
    }

    try {
      setIsSubmitting(true);
      const updatedSession = await dispatch(
        changePassword({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      ).unwrap();
      try {
        await credentialStorageService.save(updatedSession.client.code, {
          email: updatedSession.employee.email,
          password: values.newPassword,
        });
      } catch {
        // Credential storage is optional and must not undo a successful change.
      }
    } catch (error) {
      showFailure(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordInput = (
    name: keyof FormValues,
    label: string,
    autoComplete: 'current-password' | 'new-password',
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <AppTextInput
          accessibilityLabel={label}
          autoCapitalize="none"
          autoComplete={autoComplete}
          autoCorrect={false}
          label={label}
          onChangeText={onChange}
          right={
            <TextInput.Icon
              accessibilityLabel={visibleField === name ? 'Hide password' : 'Show password'}
              forceTextInputFocus={false}
              icon={visibleField === name ? hidePasswordIcon : showPasswordIcon}
              onPress={() => setVisibleField(current => current === name ? undefined : name)}
            />
          }
          secureTextEntry={visibleField !== name}
          value={value}
        />
      )}
    />
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Create a new password</Text>
        <Text style={styles.subtitle}>
          Your temporary password must be changed before mobile ESS can be used.
        </Text>
      </View>
      <Card>
        <Text style={styles.account}>{session?.employee.email || 'Employee account'}</Text>
        {passwordInput('currentPassword', 'Current password', 'current-password')}
        {passwordInput('newPassword', 'New password', 'new-password')}
        {passwordInput('confirmPassword', 'Confirm new password', 'new-password')}
        <PrimaryButton icon={changeIcon} loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
          Change password
        </PrimaryButton>
        <PrimaryButton
          disabled={isSubmitting}
          icon={logoutIcon}
          mode="outlined"
          onPress={() => dispatch(logout())}>
          Sign out
        </PrimaryButton>
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  account: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
});

export default ChangePasswordScreen;

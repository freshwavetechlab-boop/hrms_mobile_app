import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar } from 'react-native-paper';
import {
  BriefcaseBusiness,
  CalendarDays,
  CreditCard,
  IdCard,
  Mail,
  MapPin,
  ShieldCheck,
  UserRound,
  Users,
} from '../../icons/lucide';
import { StateView } from '../../components/feedback/StateView';
import { AppTextInput } from '../../components/forms/AppTextInput';
import { DatePickerField } from '../../components/forms/DatePickerField';
import { PrimaryButton } from '../../components/forms/PrimaryButton';
import { Card } from '../../components/layout/Card';
import { IconBadge } from '../../components/layout/IconBadge';
import { Screen } from '../../components/layout/Screen';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { EmployeeDocumentsSection } from '../../components/profile/EmployeeDocumentsSection';
import { useTranslation } from '../../localization/useTranslation';
import { essApiService } from '../../services/essApiService';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { saveSelfProfile } from '../../store/slices/authSlice';
import { AppColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemedStyles } from '../../theme/useAppTheme';
import {
  EmployeeSelfProfile,
  SaveEmployeeSelfProfileRequest,
} from '../../types/domain';
import { getErrorMessage } from '../../utils/errorMessage';

type LoadState = 'loading' | 'ready' | 'error';
type ProfileField = keyof SaveEmployeeSelfProfileRequest;

const paymentModes = ['Bank Transfer', 'Cheque', 'Cash'];

const toForm = (
  profile: EmployeeSelfProfile,
): SaveEmployeeSelfProfileRequest => ({
  firstName: profile.firstName,
  lastName: profile.lastName,
  workEmail: profile.workEmail,
  dateOfBirth: profile.dateOfBirth,
  mobile: profile.mobile,
  panNumber: profile.panNumber,
  aadhaarNumber: profile.aadhaarNumber,
  address: profile.address,
  correspondenceAddress: profile.correspondenceAddress,
  permanentAddress: profile.permanentAddress,
  city: profile.city,
  district: profile.district,
  state: profile.state,
  bankName: profile.bankName,
  bankAccountNo: profile.bankAccountNo,
  ifscCode: profile.ifscCode,
  paymentMode: profile.paymentMode,
});

const normalizedForm = (
  form: SaveEmployeeSelfProfileRequest,
): SaveEmployeeSelfProfileRequest => ({
  ...form,
  firstName: form.firstName.trim(),
  lastName: form.lastName.trim(),
  workEmail: form.workEmail.trim(),
  dateOfBirth: form.dateOfBirth.trim(),
  mobile: form.mobile.trim(),
  panNumber: form.panNumber.trim().toUpperCase(),
  aadhaarNumber: form.aadhaarNumber.trim(),
  address: form.address.trim(),
  correspondenceAddress: form.correspondenceAddress.trim(),
  permanentAddress: form.permanentAddress.trim(),
  city: form.city.trim(),
  district: form.district.trim(),
  state: form.state.trim(),
  bankName: form.bankName.trim(),
  bankAccountNo: form.bankAccountNo.trim(),
  ifscCode: form.ifscCode.trim().toUpperCase(),
  paymentMode: form.paymentMode.trim(),
});

const ProfileScreen = () => {
  const styles = useThemedStyles(createStyles);
  const dispatch = useAppDispatch();
  const employee = useAppSelector(state => state.auth.session?.employee);
  const { t } = useTranslation();
  const [profile, setProfile] = useState<EmployeeSelfProfile>();
  const [form, setForm] = useState<SaveEmployeeSelfProfileRequest>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [isSaving, setIsSaving] = useState(false);
  const requestSequence = useRef(0);
  const savingRef = useRef(false);

  const loadProfile = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoadState('loading');
    try {
      const response = await essApiService.getSelfProfile();
      if (sequence !== requestSequence.current) return;
      setProfile(response);
      setForm(toForm(response));
      setLoadState('ready');
    } catch {
      if (sequence !== requestSequence.current) return;
      setLoadState('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile().catch(() => undefined);
      return () => {
        requestSequence.current += 1;
      };
    }, [loadProfile]),
  );

  const setField = <K extends ProfileField>(
    field: K,
    value: SaveEmployeeSelfProfileRequest[K],
  ) => {
    setForm(current => (current ? { ...current, [field]: value } : current));
  };

  const showSaveError = (error: unknown) => {
    const code = getErrorMessage(error);
    const message =
      code === 'PROFILE_EDIT_DISABLED'
        ? t('profileEditDisabledMessage')
        : code === 'PROFILE_EMAIL_INVALID'
        ? t('profileInvalidEmail')
        : code === 'SESSION_EXPIRED'
        ? t('sessionExpired')
        : code === 'NETWORK_UNAVAILABLE'
        ? t('networkUnavailableMessage')
        : code === 'REQUEST_TIMEOUT'
        ? t('requestTimedOutMessage')
        : code === 'SERVER_UNAVAILABLE'
        ? t('serverUnavailableMessage')
        : code && !code.startsWith('PROFILE_')
        ? code
        : t('profileSaveFailedMessage');
    Alert.alert(t('profileSaveFailed'), message);
  };

  const save = async () => {
    if (!profile?.canEdit || !form || savingRef.current) return;
    const request = normalizedForm(form);
    if (!request.firstName) {
      Alert.alert(t('profileSaveFailed'), t('profileFirstNameRequired'));
      return;
    }
    if (
      !request.workEmail ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(request.workEmail)
    ) {
      Alert.alert(t('profileSaveFailed'), t('profileInvalidEmail'));
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      const result = await dispatch(saveSelfProfile(request)).unwrap();
      setProfile(result.profile);
      setForm(toForm(result.profile));
      Alert.alert(t('profileSaved'), t('profileSavedMessage'));
    } catch (error) {
      showSaveError(error);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const displayName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(' ')
    : employee?.name;
  const avatarLabel =
    displayName?.replace(/\s+/g, '').slice(0, 2).toUpperCase() || 'HR';
  const modes = useMemo(
    () =>
      profile?.paymentMode && !paymentModes.includes(profile.paymentMode)
        ? [...paymentModes, profile.paymentMode]
        : paymentModes,
    [profile?.paymentMode],
  );

  return (
    <Screen includeTopInset={false}>
      <Card>
        <View style={styles.header}>
          <Avatar.Text label={avatarLabel} size={64} />
          <View style={styles.headerText}>
            <Text accessibilityRole="header" style={styles.title}>
              {displayName || t('profile')}
            </Text>
            <Text style={styles.body}>
              {profile?.designation || employee?.designation}
            </Text>
          </View>
          {profile ? (
            <View
              style={[
                styles.editBadge,
                profile.canEdit ? styles.editBadgeEnabled : undefined,
              ]}
            >
              <Text
                style={[
                  styles.editBadgeText,
                  profile.canEdit ? styles.editBadgeTextEnabled : undefined,
                ]}
              >
                {profile.canEdit
                  ? t('profileSelfUpdateEnabled')
                  : t('profileReadOnly')}
              </Text>
            </View>
          ) : null}
        </View>
      </Card>

      <SectionHeader title={t('employeeInformation')} />
      {loadState === 'loading' && !profile ? (
        <Card>
          <StateView message={t('profileLoading')} type="loading" />
        </Card>
      ) : loadState === 'error' && !profile ? (
        <Card>
          <StateView
            message={t('profileLoadFailed')}
            onRetry={loadProfile}
            type="error"
          />
        </Card>
      ) : profile ? (
        <>
          <Card>
            <Info
              Icon={IdCard}
              label={t('employeeIdShort')}
              value={profile.employeeCode}
            />
            <Info
              Icon={BriefcaseBusiness}
              label={t('department')}
              value={profile.department}
            />
            <Info
              Icon={BriefcaseBusiness}
              label={t('designation')}
              value={profile.designation}
            />
            <Info Icon={Mail} label={t('email')} value={profile.workEmail} />
            <Info
              Icon={Users}
              label={t('reportingManager')}
              value={profile.reportingManager}
            />
            <Info
              Icon={CalendarDays}
              label={t('dateOfJoining')}
              value={profile.dateOfJoining}
            />
            <Info
              Icon={MapPin}
              label={t('workLocation')}
              value={profile.workLocation}
            />
            <Info
              Icon={MapPin}
              label={t('attendanceOffice')}
              value={profile.attendanceOffice}
            />
          </Card>

          {profile.canEdit && form ? (
            <>
              <SectionHeader title={t('profilePersonalDetails')} />
              <Card>
                <FormHeading
                  Icon={UserRound}
                  title={t('profileBasicContact')}
                />
                <AppTextInput
                  label={t('firstName')}
                  onChangeText={value => setField('firstName', value)}
                  value={form.firstName}
                />
                <AppTextInput
                  label={t('lastName')}
                  onChangeText={value => setField('lastName', value)}
                  value={form.lastName}
                />
                <AppTextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  label={t('workEmail')}
                  onChangeText={value => setField('workEmail', value)}
                  value={form.workEmail}
                />
                <DatePickerField
                  allowClear
                  label={t('dateOfBirth')}
                  maximumDate={new Date()}
                  onChange={value => setField('dateOfBirth', value)}
                  value={form.dateOfBirth}
                />
                <AppTextInput
                  keyboardType="phone-pad"
                  label={t('mobile')}
                  onChangeText={value => setField('mobile', value)}
                  value={form.mobile}
                />
                <AppTextInput
                  autoCapitalize="characters"
                  label={t('pan')}
                  maxLength={10}
                  onChangeText={value =>
                    setField('panNumber', value.toUpperCase())
                  }
                  value={form.panNumber}
                />
                <AppTextInput
                  keyboardType="number-pad"
                  label={t('aadhaar')}
                  maxLength={12}
                  onChangeText={value => setField('aadhaarNumber', value)}
                  value={form.aadhaarNumber}
                />
              </Card>

              <Card>
                <FormHeading Icon={MapPin} title={t('addressDetails')} />
                <AppTextInput
                  label={t('currentAddress')}
                  multiline
                  numberOfLines={3}
                  onChangeText={value => setField('address', value)}
                  value={form.address}
                />
                <AppTextInput
                  label={t('correspondenceAddress')}
                  multiline
                  numberOfLines={3}
                  onChangeText={value =>
                    setField('correspondenceAddress', value)
                  }
                  value={form.correspondenceAddress}
                />
                <AppTextInput
                  label={t('permanentAddress')}
                  multiline
                  numberOfLines={3}
                  onChangeText={value => setField('permanentAddress', value)}
                  value={form.permanentAddress}
                />
                <View style={styles.compactGrid}>
                  <AppTextInput
                    label={t('city')}
                    onChangeText={value => setField('city', value)}
                    style={styles.compactField}
                    value={form.city}
                  />
                  <AppTextInput
                    label={t('district')}
                    onChangeText={value => setField('district', value)}
                    style={styles.compactField}
                    value={form.district}
                  />
                </View>
                <AppTextInput
                  label={t('state')}
                  onChangeText={value => setField('state', value)}
                  value={form.state}
                />
              </Card>

              <Card>
                <FormHeading Icon={CreditCard} title={t('bankDetails')} />
                <AppTextInput
                  label={t('bankName')}
                  onChangeText={value => setField('bankName', value)}
                  value={form.bankName}
                />
                <AppTextInput
                  keyboardType="number-pad"
                  label={t('bankAccountNumber')}
                  onChangeText={value => setField('bankAccountNo', value)}
                  value={form.bankAccountNo}
                />
                <AppTextInput
                  autoCapitalize="characters"
                  label={t('ifsc')}
                  onChangeText={value =>
                    setField('ifscCode', value.toUpperCase())
                  }
                  value={form.ifscCode}
                />
                <Text style={styles.fieldLabel}>{t('paymentMode')}</Text>
                <View style={styles.optionRow}>
                  {modes.map(mode => {
                    const selected = form.paymentMode === mode;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        key={mode}
                        onPress={() => setField('paymentMode', mode)}
                        style={[
                          styles.option,
                          selected ? styles.optionSelected : undefined,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            selected ? styles.optionTextSelected : undefined,
                          ]}
                        >
                          {mode}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>

              <View style={styles.actions}>
                <PrimaryButton
                  disabled={isSaving}
                  mode="outlined"
                  onPress={() => setForm(toForm(profile))}
                  style={styles.actionButton}
                >
                  {t('reset')}
                </PrimaryButton>
                <PrimaryButton
                  disabled={isSaving}
                  loading={isSaving}
                  onPress={save}
                  style={styles.actionButton}
                >
                  {t('saveProfile')}
                </PrimaryButton>
              </View>
            </>
          ) : (
            <Card muted>
              <View style={styles.readOnlyNotice}>
                <IconBadge Icon={ShieldCheck} tone="secondary" size={18} />
                <View style={styles.noticeCopy}>
                  <Text style={styles.noticeTitle}>{t('profileReadOnly')}</Text>
                  <Text style={styles.body}>
                    {t('profileEditDisabledMessage')}
                  </Text>
                </View>
              </View>
            </Card>
          )}
        </>
      ) : null}

      <SectionHeader title={t('documents')} />
      <EmployeeDocumentsSection />
    </Screen>
  );
};

const FormHeading = ({
  Icon,
  title,
}: {
  Icon: React.ComponentProps<typeof IconBadge>['Icon'];
  title: string;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.formHeading}>
      <IconBadge Icon={Icon} tone="primary" size={18} />
      <Text accessibilityRole="header" style={styles.formTitle}>
        {title}
      </Text>
    </View>
  );
};

const Info = ({
  Icon,
  label,
  value,
}: {
  Icon: React.ComponentProps<typeof IconBadge>['Icon'];
  label: string;
  value?: string;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.infoRow}>
      <IconBadge Icon={Icon} tone="primary" size={16} />
      <View style={styles.infoCopy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value?.trim() || 'Not assigned'}</Text>
      </View>
    </View>
  );
};

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.lg,
    },
    headerText: {
      flex: 1,
      minWidth: 140,
    },
    title: {
      ...typography.sectionTitle,
      color: colors.text,
    },
    body: {
      ...typography.body,
      color: colors.textMuted,
    },
    editBadge: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    editBadgeEnabled: {
      backgroundColor: colors.successSoft,
    },
    editBadgeText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    editBadgeTextEnabled: {
      color: colors.success,
    },
    infoRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
    },
    infoCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    label: {
      ...typography.caption,
      color: colors.textMuted,
    },
    value: {
      ...typography.body,
      color: colors.text,
    },
    formHeading: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    formTitle: {
      ...typography.sectionTitle,
      color: colors.text,
      fontSize: 16,
    },
    compactGrid: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    compactField: {
      flex: 1,
    },
    fieldLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    optionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    option: {
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    optionSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    optionText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    optionTextSelected: {
      color: colors.primary,
      fontWeight: '700',
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    actionButton: {
      flex: 1,
    },
    readOnlyNotice: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: spacing.md,
    },
    noticeCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    noticeTitle: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
  });

export default ProfileScreen;

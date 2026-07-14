import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { ArrowRight, Building2, KeyRound, ShieldCheck } from 'lucide-react-native';
import { TextInput } from 'react-native-paper';
import { AppTextInput } from '../../components/forms/AppTextInput';
import { PrimaryButton } from '../../components/forms/PrimaryButton';
import { Card } from '../../components/layout/Card';
import { IconBadge } from '../../components/layout/IconBadge';
import { Screen } from '../../components/layout/Screen';
import { useTranslation } from '../../localization/useTranslation';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { validateClientCode } from '../../store/slices/clientSlice';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type FormValues = {
  clientCode: string;
};

const continueIcon = () => <ArrowRight color={colors.surface} size={18} />;
const keyIcon = () => <KeyRound color={colors.textMuted} size={18} />;

const ClientCodeScreen = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const isValidating = useAppSelector(state => state.client.isValidating);
  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: { clientCode: '' },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await dispatch(validateClientCode(values.clientCode)).unwrap();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'NETWORK_UNAVAILABLE') {
        Alert.alert(t('networkUnavailable'), t('networkUnavailableMessage'));
        return;
      }
      if (
        message === 'CLIENT_VALIDATION_UNAVAILABLE' ||
        message === 'CLIENT_VALIDATION_INVALID_RESPONSE'
      ) {
        Alert.alert(t('clientValidationUnavailable'), t('clientValidationUnavailableMessage'));
        return;
      }
      Alert.alert(t('invalidClientCode'), t('invalidClientCodeMessage'));
    }
  };

  return (
    <Screen>
      <View style={styles.brandPanel}>
        <View style={styles.logoMark}>
          <Building2 color={colors.surface} size={30} strokeWidth={2.4} />
        </View>
        <View style={styles.brandCopy}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('clientCodeTitle')}
          </Text>
          <Text style={styles.subtitle}>{t('clientCodeSubtitle')}</Text>
        </View>
      </View>

      <Card>
        <View style={styles.notice}>
          <IconBadge Icon={ShieldCheck} tone="success" size={18} />
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>{t('multiClientReady')}</Text>
            <Text style={styles.noticeBody}>{t('clientBrandingHint')}</Text>
          </View>
        </View>
        <Controller
          control={control}
          name="clientCode"
          render={({ field: { onChange, value } }) => (
            <AppTextInput
              accessibilityLabel={t('clientCodeLabel')}
              autoCapitalize="characters"
              left={<TextInput.Icon icon={keyIcon} />}
              label={t('clientCodeLabel')}
              onChangeText={text => onChange(text.toUpperCase())}
              value={value}
            />
          )}
        />
        <PrimaryButton icon={continueIcon} loading={isValidating} onPress={handleSubmit(onSubmit)}>
          {t('continue')}
        </PrimaryButton>
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  brandPanel: {
    backgroundColor: colors.primaryDark,
    borderRadius: 8,
    gap: spacing.lg,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 8,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  brandCopy: {
    gap: spacing.sm,
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
    backgroundColor: colors.secondarySoft,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
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
  noticeBody: {
    ...typography.caption,
    color: colors.textMuted,
  },
});

export default ClientCodeScreen;

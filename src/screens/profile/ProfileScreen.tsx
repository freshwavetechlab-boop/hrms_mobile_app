import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from 'react-native-paper';
import { BriefcaseBusiness, CalendarDays, IdCard, Mail, MapPin, Users } from 'lucide-react-native';
import { Card } from '../../components/layout/Card';
import { IconBadge } from '../../components/layout/IconBadge';
import { Screen } from '../../components/layout/Screen';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { useAppSelector } from '../../store/hooks';
import { useTranslation } from '../../localization/useTranslation';
import { AppColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { EmployeeDocumentsSection } from '../../components/profile/EmployeeDocumentsSection';

const ProfileScreen = () => {
  const styles = useThemedStyles(createStyles);
  const employee = useAppSelector(state => state.auth.session?.employee);
  const { t } = useTranslation();

  return (
    <Screen includeTopInset={false}>
      <Card>
        <View style={styles.header}>
          <Avatar.Text label={employee?.name.slice(0, 2).toUpperCase() ?? 'HR'} size={64} />
          <View style={styles.headerText}>
            <Text accessibilityRole="header" style={styles.title}>
              {employee?.name}
            </Text>
            <Text style={styles.body}>{employee?.designation}</Text>
          </View>
        </View>
      </Card>
      <SectionHeader title={t('employeeInformation')} />
      <Card>
        <Info Icon={IdCard} label={t('employeeIdShort')} value={employee?.id} />
        <Info Icon={BriefcaseBusiness} label={t('department')} value={employee?.department} />
        <Info Icon={Mail} label={t('email')} value={employee?.email} />
        <Info Icon={Users} label={t('reportingManager')} value={employee?.manager} />
        <Info Icon={CalendarDays} label={t('dateOfJoining')} value={employee?.dateOfJoining} />
        <Info Icon={MapPin} label={t('workLocation')} value={employee?.workLocation} />
        <Info Icon={MapPin} label={t('attendanceOffice')} value={employee?.attendanceOffice} />
      </Card>
      <SectionHeader title={t('documents')} />
      <EmployeeDocumentsSection />
    </Screen>
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
  if (!value?.trim()) {
    return null;
  }
  return (
    <View style={styles.infoRow}>
      <IconBadge Icon={Icon} tone="primary" size={16} />
      <View style={styles.infoCopy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
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
});

export default ProfileScreen;

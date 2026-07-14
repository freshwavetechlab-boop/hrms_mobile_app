import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { Card } from './Card';
import { IconBadge } from './IconBadge';
import { AppColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Props = {
  label: string;
  value: string;
  Icon: LucideIcon;
  tone?: React.ComponentProps<typeof IconBadge>['tone'];
};

export const MetricCard = ({ label, value, Icon, tone = 'primary' }: Props) => {
  const styles = useThemedStyles(createStyles);
  return (
    <Card muted style={styles.card}>
      <View style={styles.header}>
        <IconBadge Icon={Icon} tone={tone} />
        <Text style={styles.value}>{value}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </Card>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  card: {
    width: '48%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  value: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
  },
});

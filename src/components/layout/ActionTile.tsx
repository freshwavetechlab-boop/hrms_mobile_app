import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { IconBadge } from './IconBadge';
import { AppColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { TOUCH_TARGET } from '../../constants/app';

type Props = {
  title: string;
  subtitle?: string;
  Icon: LucideIcon;
  tone?: React.ComponentProps<typeof IconBadge>['tone'];
  onPress?: () => void;
};

export const ActionTile = ({ title, subtitle, Icon, tone = 'primary', onPress }: Props) => {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.tile}>
      <IconBadge Icon={Icon} tone={tone} size={18} />
      <View style={styles.textWrap}>
        <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  tile: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: TOUCH_TARGET + 40,
    padding: spacing.md,
    width: '48%',
  },
  textWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: 16,
    lineHeight: 21,
    color: colors.text,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
});

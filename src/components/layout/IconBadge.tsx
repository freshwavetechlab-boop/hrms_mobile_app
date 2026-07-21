import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { Shield } from '../../icons/lucide';
import { useAppColors } from '../../theme/useAppTheme';

type Props = {
  Icon: LucideIcon;
  tone?: 'primary' | 'success' | 'warning' | 'accent' | 'secondary';
  size?: number;
};

export const IconBadge = ({ Icon, tone = 'primary', size = 20 }: Props) => {
  const colors = useAppColors();
  // Metro intentionally exposes a slim icon barrel. Keep the UI renderable if
  // a future screen references an icon before that barrel is updated.
  const ResolvedIcon = Icon || Shield;
  const toneStyles = {
    primary: { backgroundColor: colors.primarySoft, color: colors.primary },
    success: { backgroundColor: colors.successSoft, color: colors.success },
    warning: { backgroundColor: colors.warningSoft, color: colors.warning },
    accent: { backgroundColor: colors.accentSoft, color: colors.accent },
    secondary: { backgroundColor: colors.secondarySoft, color: colors.secondary },
  };
  const toneStyle = toneStyles[tone];

  return (
    <View style={[styles.badge, { backgroundColor: toneStyle.backgroundColor }]}>
      <ResolvedIcon color={toneStyle.color} size={size} strokeWidth={2.2} />
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});

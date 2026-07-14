import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getClientLogo } from '../../assets/clientLogos';
import { ClientBranding } from '../../types/domain';
import { AppColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useAppTheme';
import { typography } from '../../theme/typography';

type Props = {
  branding?: ClientBranding;
  size?: 'sm' | 'md' | 'lg';
  wide?: boolean;
};

export const ClientLogo = ({ branding, size = 'md', wide = false }: Props) => {
  const source = getClientLogo(branding?.logoKey);
  const styles = useThemedStyles(createStyles);

  return (
    <View
      accessibilityLabel="Client logo"
      accessibilityRole="image"
      style={[
        styles.logo,
        size === 'sm' ? styles.small : undefined,
        size === 'md' ? styles.medium : undefined,
        size === 'lg' ? styles.large : undefined,
        wide ? styles.wide : undefined,
      ]}>
      {source ? (
        <Image resizeMode="contain" source={source} style={styles.image} />
      ) : (
        <Text style={styles.initials}>{branding?.logoInitials ?? 'HR'}</Text>
      )}
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  logo: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  small: {
    height: 48,
    width: 48,
  },
  medium: {
    height: 56,
    width: 56,
  },
  large: {
    height: 72,
    width: 72,
  },
  wide: {
    width: 132,
  },
  image: {
    height: '88%',
    width: '88%',
  },
  initials: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '800',
  },
});

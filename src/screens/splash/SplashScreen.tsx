import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { APP_CONFIG } from '../../constants/app';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const SplashScreen = () => (
  <View style={styles.container}>
    <View accessibilityLabel="Company logo" style={styles.logo}>
      <Text style={styles.logoText}>HR</Text>
    </View>
    <Text style={styles.title}>{APP_CONFIG.companyName}</Text>
    <ActivityIndicator accessibilityLabel="Loading application" />
    <Text style={styles.version}>Version {APP_CONFIG.version}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  logoText: {
    ...typography.title,
    color: colors.surface,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
  },
});

export default SplashScreen;

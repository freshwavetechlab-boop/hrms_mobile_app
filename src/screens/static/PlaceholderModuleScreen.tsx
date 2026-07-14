import React from 'react';
import { Text } from 'react-native';
import { Card } from '../../components/layout/Card';
import { Screen } from '../../components/layout/Screen';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { typography } from '../../theme/typography';
import { colors } from '../../theme/colors';
import { StyleSheet } from 'react-native';

export const PlaceholderModuleScreen = ({ title }: { title: string }) => (
  <Screen>
    <SectionHeader title={title} />
    <Card>
      <Text style={styles.body}>
        Production-ready UI placeholder with repository and API boundaries prepared.
      </Text>
    </Card>
  </Screen>
);

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.textMuted,
  },
});

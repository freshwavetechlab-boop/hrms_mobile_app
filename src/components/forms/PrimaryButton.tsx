import React from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { TOUCH_TARGET } from '../../constants/app';

type Props = React.ComponentProps<typeof Button>;

export const PrimaryButton = (props: Props) => (
  <Button mode="contained" contentStyle={styles.content} style={styles.button} {...props} />
);

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
  },
  content: {
    minHeight: TOUCH_TARGET,
  },
});

import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns/format';
import { isValid } from 'date-fns/isValid';
import { parse } from 'date-fns/parse';
import { startOfDay } from 'date-fns/startOfDay';
import { CalendarDays } from 'lucide-react-native';
import { Button, TextInput } from 'react-native-paper';
import { AppColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemedStyles } from '../../theme/useAppTheme';
import { AppTextInput } from './AppTextInput';

const DATE_VALUE_FORMAT = 'yyyy-MM-dd';

const calendarIcon = ({ color, size }: { color: string; size: number }) => (
  <CalendarDays color={color} size={size} />
);

const parseDateValue = (value: string) => {
  const parsed = startOfDay(parse(value, DATE_VALUE_FORMAT, new Date()));
  return isValid(parsed) && format(parsed, DATE_VALUE_FORMAT) === value
    ? parsed
    : startOfDay(new Date());
};

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  accessibilityLabel?: string;
  testID?: string;
};

export const DatePickerField = ({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  disabled = false,
  error = false,
  helperText,
  accessibilityLabel,
  testID,
}: Props) => {
  const styles = useThemedStyles(createStyles);
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const [pickerVisible, setPickerVisible] = useState(false);

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setPickerVisible(false);
    }
    if (event.type === 'set' && date) {
      onChange(format(date, DATE_VALUE_FORMAT));
    }
  };

  const openPicker = () => {
    if (!disabled) {
      setPickerVisible(true);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityValue={{ text: format(selectedDate, 'dd MMM yyyy') }}
        disabled={disabled}
        onPress={openPicker}
        testID={testID}>
        <View pointerEvents="none">
          <AppTextInput
            accessible={false}
            disabled={disabled}
            editable={false}
            error={error}
            label={label}
            right={
              <TextInput.Icon icon={calendarIcon} />
            }
            showSoftInputOnFocus={false}
            testID={testID ? `${testID}-input` : undefined}
            value={format(selectedDate, 'dd MMM yyyy')}
          />
        </View>
      </Pressable>

      {helperText ? (
        <Text style={[styles.helperText, error ? styles.errorText : undefined]}>{helperText}</Text>
      ) : null}

      {pickerVisible ? (
        <View style={Platform.OS === 'ios' ? styles.iosPicker : undefined}>
          <DateTimePicker
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            mode="date"
            onChange={handleDateChange}
            value={selectedDate}
          />
          {Platform.OS === 'ios' ? (
            <Button compact onPress={() => setPickerVisible(false)}>
              Done
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      gap: spacing.xs,
    },
    helperText: {
      ...typography.caption,
      color: colors.textMuted,
      paddingHorizontal: spacing.md,
    },
    errorText: {
      color: colors.warning,
    },
    iosPicker: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
      padding: spacing.sm,
    },
  });

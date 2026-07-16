import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addMonths } from 'date-fns/addMonths';
import { format } from 'date-fns/format';
import { isAfter } from 'date-fns/isAfter';
import { isBefore } from 'date-fns/isBefore';
import { isValid } from 'date-fns/isValid';
import { parse } from 'date-fns/parse';
import { startOfMonth } from 'date-fns/startOfMonth';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react-native';
import { Surface } from 'react-native-paper';
import { AppColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemedStyles } from '../../theme/useAppTheme';

const MONTH_VALUE_FORMAT = 'yyyy-MM';

const parseMonthValue = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const parsed = startOfMonth(parse(value, MONTH_VALUE_FORMAT, new Date()));
  return isValid(parsed) && format(parsed, MONTH_VALUE_FORMAT) === value ? parsed : undefined;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  minimumMonth?: string;
  maximumMonth?: string;
  disabled?: boolean;
  compact?: boolean;
  testID?: string;
};

export const MonthYearSelector = ({
  value,
  onChange,
  label,
  minimumMonth,
  maximumMonth,
  disabled = false,
  compact = false,
  testID,
}: Props) => {
  const styles = useThemedStyles(createStyles);
  const selectedMonth = useMemo(
    () => parseMonthValue(value) ?? startOfMonth(new Date()),
    [value],
  );
  const earliestMonth = useMemo(() => parseMonthValue(minimumMonth), [minimumMonth]);
  const latestMonth = useMemo(() => parseMonthValue(maximumMonth), [maximumMonth]);
  const previousMonth = addMonths(selectedMonth, -1);
  const nextMonth = addMonths(selectedMonth, 1);
  const previousYear = addMonths(selectedMonth, -12);
  const nextYear = addMonths(selectedMonth, 12);
  const previousDisabled =
    disabled || Boolean(earliestMonth && isBefore(previousMonth, earliestMonth));
  const nextDisabled = disabled || Boolean(latestMonth && isAfter(nextMonth, latestMonth));
  const previousYearDisabled =
    disabled || Boolean(earliestMonth && isBefore(previousYear, earliestMonth));
  const nextYearDisabled = disabled || Boolean(latestMonth && isAfter(nextYear, latestMonth));

  const selectMonth = (monthOffset: number) => {
    const nextValue = format(addMonths(selectedMonth, monthOffset), MONTH_VALUE_FORMAT);
    if (nextValue !== value) {
      onChange(nextValue);
    }
  };

  return (
    <View style={styles.container} testID={testID}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Surface
        elevation={0}
        style={[styles.selector, compact ? styles.selectorCompact : undefined]}>
        {!compact ? (
          <Pressable
            accessibilityLabel="Previous year"
            accessibilityRole="button"
            accessibilityState={{ disabled: previousYearDisabled }}
            disabled={previousYearDisabled}
            hitSlop={8}
            onPress={() => selectMonth(-12)}
            style={({ pressed }) => [
              styles.navigationButton,
              previousYearDisabled ? styles.navigationButtonDisabled : undefined,
              pressed && !previousYearDisabled ? styles.navigationButtonPressed : undefined,
            ]}
            testID={testID ? `${testID}-previous-year` : undefined}>
            <ChevronsLeft
              color={previousYearDisabled ? styles.disabledIcon.color : styles.icon.color}
              size={20}
            />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel="Previous month"
          accessibilityRole="button"
          accessibilityState={{ disabled: previousDisabled }}
          disabled={previousDisabled}
          hitSlop={8}
          onPress={() => selectMonth(-1)}
          style={({ pressed }) => [
            styles.navigationButton,
            compact ? styles.navigationButtonCompact : undefined,
            previousDisabled ? styles.navigationButtonDisabled : undefined,
            pressed && !previousDisabled ? styles.navigationButtonPressed : undefined,
          ]}
          testID={testID ? `${testID}-previous` : undefined}>
          <ChevronLeft
            color={previousDisabled ? styles.disabledIcon.color : styles.icon.color}
            size={20}
          />
        </Pressable>

        <View accessibilityLiveRegion="polite" style={styles.valueContainer}>
          <Text style={styles.month}>
            {format(selectedMonth, compact ? 'MMM yyyy' : 'MMMM')}
          </Text>
          {!compact ? <Text style={styles.year}>{format(selectedMonth, 'yyyy')}</Text> : null}
        </View>

        <Pressable
          accessibilityLabel="Next month"
          accessibilityRole="button"
          accessibilityState={{ disabled: nextDisabled }}
          disabled={nextDisabled}
          hitSlop={8}
          onPress={() => selectMonth(1)}
          style={({ pressed }) => [
            styles.navigationButton,
            compact ? styles.navigationButtonCompact : undefined,
            nextDisabled ? styles.navigationButtonDisabled : undefined,
            pressed && !nextDisabled ? styles.navigationButtonPressed : undefined,
          ]}
          testID={testID ? `${testID}-next` : undefined}>
          <ChevronRight
            color={nextDisabled ? styles.disabledIcon.color : styles.icon.color}
            size={20}
          />
        </Pressable>
        {!compact ? (
          <Pressable
            accessibilityLabel="Next year"
            accessibilityRole="button"
            accessibilityState={{ disabled: nextYearDisabled }}
            disabled={nextYearDisabled}
            hitSlop={8}
            onPress={() => selectMonth(12)}
            style={({ pressed }) => [
              styles.navigationButton,
              nextYearDisabled ? styles.navigationButtonDisabled : undefined,
              pressed && !nextYearDisabled ? styles.navigationButtonPressed : undefined,
            ]}
            testID={testID ? `${testID}-next-year` : undefined}>
            <ChevronsRight
              color={nextYearDisabled ? styles.disabledIcon.color : styles.icon.color}
              size={20}
            />
          </Pressable>
        ) : null}
      </Surface>
    </View>
  );
};

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      gap: spacing.xs,
    },
    label: {
      ...typography.caption,
      color: colors.textMuted,
    },
    selector: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      minHeight: 52,
      paddingHorizontal: spacing.sm,
    },
    selectorCompact: {
      minHeight: 48,
      paddingHorizontal: spacing.xs,
    },
    navigationButton: {
      alignItems: 'center',
      borderRadius: 8,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    navigationButtonCompact: {
      height: 36,
      width: 36,
    },
    navigationButtonDisabled: {
      opacity: 0.45,
    },
    navigationButtonPressed: {
      backgroundColor: colors.primarySoft,
    },
    valueContainer: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    month: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    year: {
      ...typography.caption,
      color: colors.textMuted,
    },
    icon: {
      color: colors.primary,
    },
    disabledIcon: {
      color: colors.textMuted,
    },
  });

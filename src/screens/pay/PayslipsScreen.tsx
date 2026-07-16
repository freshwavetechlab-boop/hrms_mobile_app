import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Eye, FileText } from '../../icons/lucide';
import { Card } from '../../components/layout/Card';
import { MonthYearSelector } from '../../components/forms/MonthYearSelector';
import { PrimaryButton } from '../../components/forms/PrimaryButton';
import { Screen } from '../../components/layout/Screen';
import { StateView } from '../../components/feedback/StateView';
import { RootStackParamList } from '../../navigation/types';
import { essApiService } from '../../services/essApiService';
import { payslipExportService } from '../../services/payslipExportService';
import { useTranslation } from '../../localization/useTranslation';
import { AppColors } from '../../theme/colors';
import { useAppColors, useThemedStyles } from '../../theme/useAppTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { LoadingState, Payslip, PayslipDocument } from '../../types/domain';

const money = (value: number) => `Rs ${Number(value || 0).toLocaleString('en-IN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})}`;

const dateText = (value?: string) => {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '--'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const periodText = (period: string) => {
  const date = new Date(`${period}-01T00:00:00`);
  return Number.isNaN(date.getTime())
    ? period
    : date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};
const previewIcon = ({ color }: { color: string }) => <Eye color={color} size={17} />;
const pdfIcon = ({ color }: { color: string }) => <FileText color={color} size={17} />;

const PayslipsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useAppColors();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [rows, setRows] = useState<Payslip[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [document, setDocument] = useState<PayslipDocument>();
  const [previewRow, setPreviewRow] = useState<Payslip>();
  const [status, setStatus] = useState<LoadingState>('idle');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const items = await essApiService.getPayslips();
      setRows(items);
      setSelectedMonth(current => current || items[0]?.payPeriod || '');
      setStatus('success');
    } catch {
      setRows([]);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const periods = useMemo(
    () => rows.map(item => item.payPeriod).sort((left, right) => left.localeCompare(right)),
    [rows],
  );
  const visibleRows = useMemo(
    () => rows.filter(item => item.payPeriod === selectedMonth),
    [rows, selectedMonth],
  );

  const openPreview = async (row: Payslip) => {
    setBusy(`preview-${row.payRunId}`);
    try {
      setDocument(await essApiService.getPayslipDocument(row.payRunId));
      setPreviewRow(row);
    } catch {
      Alert.alert(t('payslipUnavailable'), t('payslipUnavailableMessage'));
    } finally {
      setBusy('');
    }
  };

  const downloadPdf = async (row: Payslip) => {
    setBusy(`pdf-${row.payRunId}`);
    try {
      const next = await essApiService.getPayslipDocument(row.payRunId);
      await payslipExportService.sharePdf(next);
    } catch {
      Alert.alert(t('payslipDownloadFailed'), t('payslipDownloadFailedMessage'));
    } finally {
      setBusy('');
    }
  };

  const downloadOpenPdf = async () => {
    if (!document) return;
    setBusy(`modal-${document.payRunId}`);
    try {
      await payslipExportService.sharePdf(document);
    } catch {
      Alert.alert(t('payslipDownloadFailed'), t('payslipDownloadFailedMessage'));
    } finally {
      setBusy('');
    }
  };

  const closePreview = () => {
    setDocument(undefined);
    setPreviewRow(undefined);
  };

  return (
    <>
      <Screen>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel={t('back')}
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <ChevronLeft color={colors.primary} size={22} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{t('payAndTax')}</Text>
            <Text accessibilityRole="header" style={styles.title}>{t('payslips')}</Text>
          </View>
        </View>

        {status === 'loading' ? <StateView message={t('loadingPayslips')} type="loading" /> : null}
        {status === 'error' ? <StateView message={t('payslipsLoadFailed')} onRetry={load} type="error" /> : null}
        {status === 'success' && rows.length === 0 ? <StateView message={t('noPayslips')} type="empty" /> : null}

        {status === 'success' && rows.length > 0 ? (
          <>
            <MonthYearSelector
              label={t('payMonth')}
              maximumMonth={periods.at(-1)}
              minimumMonth={periods[0]}
              onChange={setSelectedMonth}
              value={selectedMonth}
            />
            {visibleRows.length === 0 ? (
              <StateView message={t('noPayslipForMonth')} type="empty" />
            ) : visibleRows.map(item => (
              <Card key={item.payRunId}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardTitle}>{periodText(item.payPeriod)}</Text>
                    <Text style={styles.caption}>{t('payDate')}: {dateText(item.payDate)}</Text>
                  </View>
                  <Text style={styles.status}>{item.paymentStatus || t('pending')}</Text>
                </View>
                <View style={styles.amountGrid}>
                  <Amount label={t('grossPay')} value={money(item.grossPay)} />
                  <Amount label={t('deductions')} value={money(item.statutoryDeductions + item.oneTimeDeductions)} />
                  <Amount label={t('netPay')} value={money(item.netPay)} strong />
                </View>
                <Text style={styles.caption}>{t('payrollStatus')}: {item.runStatus || '--'}</Text>
                <View style={styles.actions}>
                  <PrimaryButton
                    disabled={Boolean(busy)}
                    icon={previewIcon}
                    mode="outlined"
                    onPress={() => { openPreview(item).catch(() => undefined); }}
                    style={styles.actionButton}>
                    {busy === `preview-${item.payRunId}` ? t('opening') : t('preview')}
                  </PrimaryButton>
                  <PrimaryButton
                    buttonColor={colors.warningSoft}
                    disabled={Boolean(busy)}
                    icon={pdfIcon}
                    mode="contained"
                    onPress={() => { downloadPdf(item).catch(() => undefined); }}
                    style={styles.actionButton}
                    textColor={colors.warning}>
                    {busy === `pdf-${item.payRunId}` ? t('preparingPdf') : t('downloadPdf')}
                  </PrimaryButton>
                </View>
              </Card>
            ))}
          </>
        ) : null}
      </Screen>

      <Modal animationType="slide" onRequestClose={closePreview} visible={Boolean(document && previewRow)}>
        <SafeAreaView style={styles.previewSafeArea}>
          <View style={styles.previewHeader}>
            <Pressable
              accessibilityLabel={t('back')}
              accessibilityRole="button"
              onPress={closePreview}
              style={styles.backButton}>
              <ChevronLeft color={colors.primary} size={22} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>{t('payslipPreview')}</Text>
              <Text style={styles.previewTitle}>{document ? periodText(document.payPeriod) : ''}</Text>
            </View>
          </View>
          {document && previewRow ? (
            <ScrollView contentContainerStyle={styles.previewContent}>
              <Card>
                <View style={styles.previewEmployee}>
                  <Text style={styles.caption}>{t('employeeIdShort')}</Text>
                  <Text style={styles.cardTitle}>{document.employeeCode || '--'}</Text>
                </View>
                <View style={styles.previewDetails}>
                  <PreviewDetail label={t('payMonth')} value={periodText(previewRow.payPeriod)} />
                  <PreviewDetail label={t('payDate')} value={dateText(previewRow.payDate)} />
                  <PreviewDetail label={t('payrollStatus')} value={previewRow.runStatus || '--'} />
                  <PreviewDetail label="Payment status" value={previewRow.paymentStatus || t('pending')} />
                  <PreviewDetail label="Payment date" value={dateText(previewRow.paymentDate)} />
                </View>
              </Card>
              <Card>
                <Text style={styles.breakdownTitle}>Pay summary</Text>
                <PreviewAmount label={t('grossPay')} value={money(previewRow.grossPay)} />
                <PreviewAmount
                  label={t('deductions')}
                  value={money(previewRow.statutoryDeductions + previewRow.oneTimeDeductions)}
                />
                <View style={styles.totalDivider} />
                <PreviewAmount label={t('netPay')} value={money(previewRow.netPay)} strong />
              </Card>
              <Text style={styles.previewHint}>
                The detailed component-wise payslip is available in the PDF below.
              </Text>
            </ScrollView>
          ) : null}
          <View style={styles.previewFooter}>
            <PrimaryButton
              buttonColor={colors.warningSoft}
              disabled={Boolean(busy)}
              icon={pdfIcon}
              onPress={() => { downloadOpenPdf().catch(() => undefined); }}
              textColor={colors.warning}>
              {document && busy === `modal-${document.payRunId}` ? t('preparingPdf') : t('downloadPdf')}
            </PrimaryButton>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const Amount = ({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.amount}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={[styles.amountValue, strong ? styles.amountStrong : undefined]}>{value}</Text>
    </View>
  );
};

const PreviewDetail = ({ label, value }: { label: string; value: string }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.previewDetail}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={styles.previewValue}>{value}</Text>
    </View>
  );
};

const PreviewAmount = ({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.previewAmount}>
      <Text style={styles.previewValue}>{label}</Text>
      <Text style={[styles.previewValue, strong ? styles.previewNet : undefined]}>{value}</Text>
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  caption: {
    ...typography.caption,
    color: colors.textMuted,
  },
  status: {
    ...typography.caption,
    backgroundColor: colors.successSoft,
    borderRadius: 999,
    color: colors.success,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  amountGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  amount: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  amountValue: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  amountStrong: {
    color: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  previewSafeArea: {
    backgroundColor: colors.surfaceMuted,
    flex: 1,
  },
  previewHeader: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  previewTitle: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  previewContent: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  previewEmployee: {
    gap: spacing.xs,
  },
  previewDetails: {
    gap: spacing.md,
  },
  previewDetail: {
    alignItems: 'flex-start',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  previewValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  breakdownTitle: {
    ...typography.sectionTitle,
    color: colors.text,
  },
  previewAmount: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  previewNet: {
    color: colors.primary,
    fontSize: 18,
  },
  totalDivider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
  },
  previewHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  previewFooter: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
});

export default PayslipsScreen;

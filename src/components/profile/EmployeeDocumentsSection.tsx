import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
} from '@react-native-documents/picker';
import { format } from 'date-fns/format';
import { ActivityIndicator, Button, ProgressBar } from 'react-native-paper';
import {
  AttachmentFieldConfiguration,
  AttachmentUploadFile,
  EntityAttachment,
} from '../../types/domain';
import { attachmentApiService } from '../../services/attachmentApiService';
import { useAppSelector } from '../../store/hooks';
import { AppColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useAppColors, useThemedStyles } from '../../theme/useAppTheme';
import { AppTextInput } from '../forms/AppTextInput';
import { Card } from '../layout/Card';
import { StateView } from '../feedback/StateView';

type Draft = {
  file?: AttachmentUploadFile;
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
};

const emptyDraft = (): Draft => ({
  documentNumber: '',
  issueDate: '',
  expiryDate: '',
});

const extensionMimeTypes: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const allowedExtensions = (configuration: AttachmentFieldConfiguration) => {
  try {
    const parsed = JSON.parse(configuration.allowedExtensionsJson);
    return Array.isArray(parsed)
      ? parsed.map(value => String(value).trim().toLowerCase()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
};

const fileExtension = (name: string) =>
  name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : '';

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`
    : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;

const absoluteTicketUrl = (baseUrl: string, ticketUrl: string) =>
  /^https?:\/\//i.test(ticketUrl)
    ? ticketUrl
    : `${baseUrl.replace(/\/+$/, '')}/${ticketUrl.replace(/^\/+/, '')}`;

export const EmployeeDocumentsSection = () => {
  const colors = useAppColors();
  const styles = useThemedStyles(createStyles);
  const session = useAppSelector(state => state.auth.session);
  const [configurations, setConfigurations] = useState<AttachmentFieldConfiguration[]>([]);
  const [attachments, setAttachments] = useState<EntityAttachment[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session?.hrmsClientId || !session.hrmsEmployeeId) {
      setError('Your employee profile is not linked for document access.');
      setLoading(false);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const [configured, files] = await Promise.all([
        attachmentApiService.getEmployeeConfigurations(session.hrmsClientId),
        attachmentApiService.getEmployeeAttachments(session.hrmsEmployeeId),
      ]);
      setConfigurations(configured);
      setAttachments(files);
      setDrafts(current =>
        Object.fromEntries(
          configured.map(configuration => [
            configuration.id,
            current[configuration.id] ?? emptyDraft(),
          ]),
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Documents could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [session?.hrmsClientId, session?.hrmsEmployeeId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const grouped = useMemo(
    () =>
      new Map(
        configurations.map(configuration => [
          configuration.id,
          attachments.filter(
            attachment => attachment.fieldConfigurationId === configuration.id,
          ),
        ]),
      ),
    [attachments, configurations],
  );

  const patchDraft = (configurationId: number, patch: Partial<Draft>) =>
    setDrafts(current => ({
      ...current,
      [configurationId]: {
        ...(current[configurationId] ?? emptyDraft()),
        ...patch,
      },
    }));

  const selectFile = async (configuration: AttachmentFieldConfiguration) => {
    try {
      const [picked] = await pick({
        type: types.allFiles,
        allowMultiSelection: false,
        allowVirtualFiles: false,
        mode: 'import',
      });
      if (!picked.name) {
        Alert.alert('File not selected', 'The selected provider did not return a file name.');
        return;
      }
      const extension = fileExtension(picked.name);
      const allowed = allowedExtensions(configuration);
      if (!allowed.includes(extension)) {
        Alert.alert(
          'File type not allowed',
          `Choose one of these formats: ${allowed.map(value => value.toUpperCase()).join(', ')}.`,
        );
        return;
      }
      const size = picked.size ?? 0;
      if (size > configuration.maximumFileSizeBytes) {
        Alert.alert(
          'File is too large',
          `Maximum allowed size is ${formatBytes(configuration.maximumFileSizeBytes)}.`,
        );
        return;
      }
      patchDraft(configuration.id, {
        file: {
          uri: picked.uri,
          name: picked.name,
          mimeType: picked.type ?? extensionMimeTypes[extension] ?? 'application/octet-stream',
          size,
        },
      });
    } catch (pickerError) {
      if (
        isErrorWithCode(pickerError) &&
        pickerError.code === errorCodes.OPERATION_CANCELED
      ) {
        return;
      }
      Alert.alert('File picker unavailable', 'The document picker could not be opened.');
    }
  };

  const upload = async (configuration: AttachmentFieldConfiguration) => {
    if (!session?.hrmsEmployeeId) {
      return;
    }
    const draft = drafts[configuration.id] ?? emptyDraft();
    if (!draft.file) {
      Alert.alert('Select document', 'Choose a file before uploading.');
      return;
    }
    if (configuration.requiresDocumentNumber && !draft.documentNumber.trim()) {
      Alert.alert('Document number required', 'Enter the document number.');
      return;
    }
    if (configuration.requiresIssueDate && !draft.issueDate) {
      Alert.alert('Issue date required', 'Select the document issue date.');
      return;
    }
    if (configuration.requiresExpiryDate && !draft.expiryDate) {
      Alert.alert('Expiry date required', 'Select the document expiry date.');
      return;
    }
    if (draft.issueDate && draft.expiryDate && draft.expiryDate < draft.issueDate) {
      Alert.alert('Invalid expiry date', 'Expiry date cannot be before issue date.');
      return;
    }

    setBusy(current => ({ ...current, [configuration.id]: true }));
    setProgress(current => ({ ...current, [configuration.id]: 0.01 }));
    try {
      await attachmentApiService.uploadEmployeeAttachment(
        configuration.id,
        session.hrmsEmployeeId,
        draft.file,
        draft,
        percent =>
          setProgress(current => ({
            ...current,
            [configuration.id]: percent / 100,
          })),
      );
      patchDraft(configuration.id, emptyDraft());
      Alert.alert('Document uploaded', `${configuration.fieldLabel} was uploaded successfully.`);
      await load();
    } catch (uploadError) {
      Alert.alert(
        'Upload failed',
        uploadError instanceof Error ? uploadError.message : 'Document upload failed.',
      );
    } finally {
      setBusy(current => ({ ...current, [configuration.id]: false }));
      setProgress(current => ({ ...current, [configuration.id]: 0 }));
    }
  };

  const openAttachment = async (
    attachment: EntityAttachment,
    purpose: 'Preview' | 'Download',
  ) => {
    if (!session?.client.apiBaseUrl) {
      return;
    }
    try {
      const ticket = await attachmentApiService.issueAccessTicket(
        attachment.publicId,
        purpose,
      );
      await Linking.openURL(absoluteTicketUrl(session.client.apiBaseUrl, ticket.url));
    } catch (openError) {
      Alert.alert(
        `${purpose} failed`,
        openError instanceof Error
          ? openError.message
          : `Document ${purpose.toLowerCase()} failed.`,
      );
    }
  };

  const deleteAttachment = (
    configuration: AttachmentFieldConfiguration,
    attachment: EntityAttachment,
  ) => {
    Alert.alert(
      'Delete document?',
      `${attachment.originalFileName} will no longer be available.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            (async () => {
              try {
                await attachmentApiService.deleteAttachment(attachment.publicId);
                await load();
              } catch (deleteError) {
                Alert.alert(
                  'Delete failed',
                  deleteError instanceof Error
                    ? deleteError.message
                    : `${configuration.fieldLabel} could not be deleted.`,
                  );
              }
            })().catch(() => undefined);
          },
        },
      ],
    );
  };

  if (loading && !configurations.length) {
    return <StateView type="loading" message="Loading configured documents..." />;
  }
  if (error) {
    return (
      <StateView
        type="error"
        message={error}
        onRetry={() => {
          load().catch(() => undefined);
        }}
      />
    );
  }
  if (!configurations.length) {
    return (
      <Card muted>
        <Text style={styles.emptyTitle}>No document fields configured</Text>
        <Text style={styles.helpText}>
          HR can configure employee document fields from Settings → Attachments.
        </Text>
      </Card>
    );
  }

  const requiredPending = configurations.filter(
    configuration =>
      configuration.isRequired && !(grouped.get(configuration.id)?.length),
  ).length;

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>My documents</Text>
          <Text style={styles.helpText}>
            Files are private and open through short-lived secure links.
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Refresh documents"
          accessibilityRole="button"
          onPress={() => {
            load().catch(() => undefined);
          }}
          style={styles.refreshButton}>
          {loading ? (
            <ActivityIndicator color={colors.primary} size={18} />
          ) : (
            <Text style={styles.actionGlyph}>R</Text>
          )}
        </Pressable>
      </View>
      <Text style={requiredPending ? styles.pending : styles.complete}>
        {requiredPending
          ? `${requiredPending} required document${requiredPending === 1 ? '' : 's'} pending`
          : 'Required documents complete'}
      </Text>

      {configurations.map(configuration => {
        const files = grouped.get(configuration.id) ?? [];
        const draft = drafts[configuration.id] ?? emptyDraft();
        const allowed = allowedExtensions(configuration);
        const canAdd = configuration.ownerCanUpload && (
          configuration.allowMultiple
            ? files.length < configuration.maximumFileCount
            : files.length === 0 ||
              (configuration.ownerCanReplace && configuration.versioningEnabled)
        );
        return (
          <Card
            key={configuration.id}
            style={
              configuration.isRequired && !files.length
                ? styles.requiredCard
                : undefined
            }>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderCopy}>
                <Text style={styles.fieldTitle}>
                  {configuration.fieldLabel}
                  {configuration.isRequired ? ' *' : ''}
                </Text>
                <Text style={styles.metaText}>
                  {configuration.attributeName} · {configuration.dataClassification}
                </Text>
              </View>
              <Text style={styles.fileCount}>
                {configuration.allowMultiple
                  ? `${files.length}/${configuration.maximumFileCount}`
                  : files.length
                    ? 'Uploaded'
                    : 'Pending'}
              </Text>
            </View>
            <Text style={styles.helpText}>
              {configuration.helpText ||
                `${allowed.map(value => value.toUpperCase()).join(', ')} · Maximum ${formatBytes(configuration.maximumFileSizeBytes)}`}
            </Text>

            {files.map(file => (
              <View key={file.publicId} style={styles.fileRow}>
                <View style={styles.fileCopy}>
                  <Text numberOfLines={2} style={styles.fileName}>
                    {file.originalFileName}
                  </Text>
                  <Text style={styles.metaText}>
                    {formatBytes(file.fileSizeBytes)} · v{file.versionNumber} ·{' '}
                    {file.verificationStatus}
                  </Text>
                  <Text style={styles.metaText}>
                    {new Date(file.uploadedAtUtc).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.fileActions}>
                  <Button
                    compact
                    mode="outlined"
                    onPress={() => {
                      openAttachment(file, 'Preview').catch(() => undefined);
                    }}>
                    View
                  </Button>
                  <Button
                    compact
                    mode="outlined"
                    onPress={() => {
                      openAttachment(file, 'Download').catch(() => undefined);
                    }}>
                    Download
                  </Button>
                  {configuration.ownerCanDelete ? (
                    <Button
                      compact
                      mode="outlined"
                      textColor={colors.warning}
                      onPress={() => deleteAttachment(configuration, file)}>
                      Delete
                    </Button>
                  ) : null}
                </View>
              </View>
            ))}

            {canAdd ? (
              <View style={styles.uploadArea}>
                {configuration.requiresDocumentNumber ? (
                  <AppTextInput
                    label="Document number"
                    value={draft.documentNumber}
                    onChangeText={documentNumber =>
                      patchDraft(configuration.id, { documentNumber })
                    }
                  />
                ) : null}
                <View style={styles.dateRow}>
                  {configuration.requiresIssueDate ? (
                    <DocumentDateField
                      label="Issue date"
                      value={draft.issueDate}
                      onChange={issueDate =>
                        patchDraft(configuration.id, { issueDate })
                      }
                    />
                  ) : null}
                  {configuration.requiresExpiryDate ? (
                    <DocumentDateField
                      label="Expiry date"
                      value={draft.expiryDate}
                      minimumDate={
                        draft.issueDate
                          ? new Date(`${draft.issueDate}T00:00:00`)
                          : undefined
                      }
                      onChange={expiryDate =>
                        patchDraft(configuration.id, { expiryDate })
                      }
                    />
                  ) : null}
                </View>
                <Pressable
                  accessibilityLabel={`Choose ${configuration.fieldLabel} file`}
                  accessibilityRole="button"
                  onPress={() => {
                    selectFile(configuration).catch(() => undefined);
                  }}
                  style={styles.filePicker}>
                  <Text style={styles.actionGlyph}>+</Text>
                  <View style={styles.filePickerCopy}>
                    <Text numberOfLines={1} style={styles.filePickerTitle}>
                      {draft.file?.name ?? 'Choose document'}
                    </Text>
                    <Text style={styles.metaText}>
                      {draft.file
                        ? formatBytes(draft.file.size)
                        : allowed.map(value => value.toUpperCase()).join(', ')}
                    </Text>
                  </View>
                </Pressable>
                {busy[configuration.id] ? (
                  <View style={styles.progress}>
                    <ProgressBar progress={progress[configuration.id] ?? 0} />
                    <Text style={styles.metaText}>Uploading securely...</Text>
                  </View>
                ) : null}
                <Button
                  disabled={!draft.file || busy[configuration.id]}
                  loading={busy[configuration.id]}
                  mode="contained"
                  onPress={() => {
                    upload(configuration).catch(() => undefined);
                  }}>
                  {files.length && !configuration.allowMultiple
                    ? 'Replace document'
                    : 'Upload document'}
                </Button>
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
};

const DocumentDateField = ({
  label,
  value,
  minimumDate,
  onChange,
}: {
  label: string;
  value: string;
  minimumDate?: Date;
  onChange: (value: string) => void;
}) => {
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const current = value ? new Date(`${value}T00:00:00`) : new Date();
  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    setOpen(false);
    if (event.type === 'set' && date) {
      onChange(format(date, 'yyyy-MM-dd'));
    }
  };
  return (
    <View style={styles.dateField}>
      <Text style={styles.dateLabel}>{label}</Text>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={styles.dateButton}>
        <Text style={styles.dateGlyph}>D</Text>
        <Text style={value ? styles.dateValue : styles.datePlaceholder}>
          {value ? format(current, 'dd MMM yyyy') : 'Select date'}
        </Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          minimumDate={minimumDate}
          mode="date"
          onChange={handleChange}
          value={current}
        />
      ) : null}
    </View>
  );
};

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    summary: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
    },
    summaryCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    summaryTitle: {
      ...typography.sectionTitle,
      color: colors.text,
    },
    refreshButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 8,
      height: 42,
      justifyContent: 'center',
      width: 42,
    },
    actionGlyph: {
      ...typography.body,
      color: colors.primary,
      fontWeight: '800',
    },
    pending: {
      ...typography.caption,
      alignSelf: 'flex-start',
      backgroundColor: colors.accentSoft,
      borderRadius: 99,
      color: colors.accent,
      overflow: 'hidden',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    complete: {
      ...typography.caption,
      alignSelf: 'flex-start',
      backgroundColor: colors.successSoft,
      borderRadius: 99,
      color: colors.success,
      overflow: 'hidden',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    requiredCard: {
      borderColor: colors.accent,
    },
    cardHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: spacing.md,
    },
    cardHeaderCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    fieldTitle: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    fileCount: {
      ...typography.caption,
      backgroundColor: colors.primarySoft,
      borderRadius: 99,
      color: colors.primary,
      overflow: 'hidden',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    helpText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    emptyTitle: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    metaText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    fileRow: {
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      gap: spacing.sm,
      padding: spacing.md,
    },
    fileCopy: {
      gap: spacing.xs,
    },
    fileName: {
      ...typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    fileActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    uploadArea: {
      borderColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: spacing.md,
      paddingTop: spacing.md,
    },
    dateRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    dateField: {
      flex: 1,
      gap: spacing.xs,
      minWidth: 140,
    },
    dateLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    dateButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      minHeight: 48,
      paddingHorizontal: spacing.md,
    },
    dateGlyph: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '800',
    },
    dateValue: {
      ...typography.body,
      color: colors.text,
    },
    datePlaceholder: {
      ...typography.body,
      color: colors.textMuted,
    },
    filePicker: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      borderRadius: 8,
      borderStyle: 'dashed',
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      minHeight: 58,
      padding: spacing.md,
    },
    filePickerCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    filePickerTitle: {
      ...typography.body,
      color: colors.primary,
      fontWeight: '600',
    },
    progress: {
      gap: spacing.xs,
    },
  });

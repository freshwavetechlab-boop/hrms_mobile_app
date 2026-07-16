import axios from 'axios';
import {
  AttachmentAccessTicket,
  AttachmentFieldConfiguration,
  AttachmentUploadFile,
  EntityAttachment,
} from '../types/domain';
import { apiClient } from './apiClient';

type UploadMetadata = {
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
};

const safeServerText = (value: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }
  const message = value.trim();
  if (
    !message ||
    message.length > 500 ||
    /\bSystem\.[A-Za-z]/.test(message) ||
    /\bat\s+Payroll\.API\./.test(message) ||
    /\\[^ \r\n]+\.cs:line\s+\d+/i.test(message)
  ) {
    return null;
  }
  return message;
};

const serverMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) {
    return safeServerText(error instanceof Error ? error.message : null) ?? fallback;
  }
  if (!error.response) {
    return 'Connect to the internet and try again.';
  }
  const data = error.response.data;
  const textMessage = safeServerText(data);
  if (textMessage) {
    return textMessage;
  }
  if (typeof data === 'object' && data !== null) {
    const source = data as Record<string, unknown>;
    for (const key of ['error', 'message', 'detail']) {
      const candidate = safeServerText(source[key]);
      if (candidate) {
        return candidate;
      }
    }
  }
  return fallback;
};

const uniqueConfigurations = (rows: AttachmentFieldConfiguration[]) =>
  [...new Map(rows.map(row => [row.id, row])).values()]
    .filter(row => row.ownerCanView || row.ownerCanUpload)
    .sort((left, right) => left.fieldLabel.localeCompare(right.fieldLabel));

export const attachmentApiService = {
  async getEmployeeConfigurations(clientId: number) {
    try {
      const [profile, createEdit] = await Promise.all([
        apiClient.get<AttachmentFieldConfiguration[]>(
          '/api/attachment-configurations/effective',
          { params: { clientId, moduleCode: 'EMPLOYEE', formCode: 'EMPLOYEE_PROFILE' } },
        ),
        apiClient.get<AttachmentFieldConfiguration[]>(
          '/api/attachment-configurations/effective',
          { params: { clientId, moduleCode: 'EMPLOYEE', formCode: 'EMPLOYEE_CREATE_EDIT' } },
        ),
      ]);
      return uniqueConfigurations([...(profile.data ?? []), ...(createEdit.data ?? [])]);
    } catch (error) {
      throw new Error(serverMessage(error, 'Configured document fields could not be loaded.'));
    }
  },

  async getEmployeeAttachments(employeeId: number) {
    try {
      const response = await apiClient.get<EntityAttachment[]>('/api/attachments', {
        params: { entityType: 'EMPLOYEE', entityId: employeeId },
      });
      return response.data ?? [];
    } catch (error) {
      throw new Error(serverMessage(error, 'Documents could not be loaded.'));
    }
  },

  async uploadEmployeeAttachment(
    configurationId: number,
    employeeId: number,
    file: AttachmentUploadFile,
    metadata: UploadMetadata,
    onProgress?: (percent: number) => void,
  ) {
    const form = new FormData();
    form.append('fieldConfigurationId', String(configurationId));
    form.append('entityType', 'EMPLOYEE');
    form.append('entityId', String(employeeId));
    form.append('documentNumber', metadata.documentNumber.trim());
    if (metadata.issueDate) {
      form.append('issueDate', metadata.issueDate);
    }
    if (metadata.expiryDate) {
      form.append('expiryDate', metadata.expiryDate);
    }
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/octet-stream',
    } as unknown as Blob);

    try {
      const response = await apiClient.post<EntityAttachment>('/api/attachments', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60_000,
        onUploadProgress: event => {
          if (event.total && onProgress) {
            onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
          }
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(serverMessage(error, 'Document upload failed.'));
    }
  },

  async deleteAttachment(publicId: string) {
    try {
      await apiClient.delete(`/api/attachments/${encodeURIComponent(publicId)}`);
    } catch (error) {
      throw new Error(serverMessage(error, 'Document could not be deleted.'));
    }
  },

  async issueAccessTicket(publicId: string, purpose: 'Preview' | 'Download') {
    try {
      const response = await apiClient.post<AttachmentAccessTicket>(
        `/api/attachments/${encodeURIComponent(publicId)}/access-ticket`,
        { purpose },
      );
      return response.data;
    } catch (error) {
      throw new Error(serverMessage(error, `Document ${purpose.toLowerCase()} failed.`));
    }
  },
};

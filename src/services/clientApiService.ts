import axios from 'axios';
import { APP_CONFIG } from '../constants/app';
import { ClientProfile } from '../types/domain';

type ApiObject = Record<string, unknown>;

const isObject = (value: unknown): value is ApiObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getValue = (source: ApiObject, keys: string[]) => {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }
  return undefined;
};

const getString = (source: ApiObject, keys: string[]) => {
  const value = getValue(source, keys);
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
};

const getBoolean = (source: ApiObject, keys: string[]) => {
  const value = getValue(source, keys);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
};

const unwrapObject = (payload: unknown): ApiObject => {
  if (!isObject(payload)) return {};
  const envelope = isObject(payload.data)
    ? payload.data
    : isObject(payload.result)
      ? payload.result
      : payload;
  return envelope;
};

const toNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const brandingFor = (code: string): ClientProfile['branding'] => ({
  primaryColor: '#062B6F',
  accentColor: '#13BFA6',
  logoInitials: code.slice(0, 3),
  logoKey: code === 'GAD' || code === 'GADIGITAL' ? 'gaDigital' : 'frevone',
});

const clientNameFor = (code: string) => (code === 'GAD' ? 'GA Digital' : code);

const normalizeApiBaseUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
    return value.replace(/\/+$/, '');
  } catch {
    throw new Error('CLIENT_VALIDATION_INVALID_RESPONSE');
  }
};

const assertValidTenantWindow = (validFromUtc: string, validUntilUtc: string) => {
  const validFrom = Date.parse(validFromUtc);
  const validUntil = Date.parse(validUntilUtc);
  if (!Number.isFinite(validFrom) || !Number.isFinite(validUntil) || validUntil <= validFrom) {
    throw new Error('CLIENT_VALIDATION_INVALID_RESPONSE');
  }
  const now = Date.now();
  if (now < validFrom || now >= validUntil) {
    throw new Error('INVALID_CLIENT_CODE');
  }
};

const normalizeTenantResolutionError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return error;
  if (error.response?.status === 400 || error.response?.status === 404) {
    return new Error('INVALID_CLIENT_CODE');
  }
  if (!error.response) return new Error('NETWORK_UNAVAILABLE');
  return new Error('CLIENT_VALIDATION_UNAVAILABLE');
};

export const tenantResolverClient = axios.create({
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

export const clientApiService = {
  async validatePublicClient(rawCode: string): Promise<ClientProfile> {
    const code = rawCode.trim().toUpperCase();
    try {
      const response = await tenantResolverClient.post(APP_CONFIG.tenantResolverUrl, {
        clientCode: code,
      });
      const payload = unwrapObject(response.data);
      const returnedCode = getString(payload, [
        'clientCode',
        'ClientCode',
        'client_code',
        'code',
        'Code',
      ]).toUpperCase();
      const active = getBoolean(payload, ['isActive', 'IsActive', 'is_active', 'active', 'Active']);
      const apiBaseUrl = normalizeApiBaseUrl(
        getString(payload, ['apiBaseUrl', 'ApiBaseUrl', 'api_base_url']),
      );
      const validFromUtc = getString(payload, ['validFromUtc', 'ValidFromUtc', 'valid_from_utc']);
      const validUntilUtc = getString(payload, ['validUntilUtc', 'ValidUntilUtc', 'valid_until_utc']);

      if (active !== true || returnedCode !== code) {
        throw new Error('INVALID_CLIENT_CODE');
      }
      assertValidTenantWindow(validFromUtc, validUntilUtc);

      return {
        id: toNumber(getValue(payload, ['id', 'Id', 'clientId', 'ClientId', 'client_id'])),
        code,
        name:
          getString(payload, ['name', 'Name', 'clientName', 'ClientName', 'client_name']) ||
          clientNameFor(code),
        supportEmail: getString(payload, ['email', 'Email', 'supportEmail', 'SupportEmail', 'support_email']),
        apiBaseUrl,
        validFromUtc,
        validUntilUtc,
        isActive: true,
        validatedAt: new Date().toISOString(),
        branding: brandingFor(code),
      };
    } catch (error) {
      throw normalizeTenantResolutionError(error);
    }
  },
};

import { APP_CONFIG } from '../src/constants/app';
import {
  clientApiService,
  tenantResolverClient,
} from '../src/services/clientApiService';
import { apiClient } from '../src/services/apiClient';
import { sessionStorage } from '../src/services/sessionStorage';

const activeWindow = () => ({
  validFromUtc: new Date(Date.now() - 60_000).toISOString(),
  validUntilUtc: new Date(Date.now() + 60_000).toISOString(),
});

describe('tenant resolution', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    sessionStorage.clearSelectedClient();
    sessionStorage.clearSession();
  });

  it('resolves and persists the tenant routing contract', async () => {
    jest.spyOn(tenantResolverClient, 'post').mockResolvedValue({
      status: 200,
      data: {
        clientCode: 'GAD',
        apiBaseUrl: 'http://api-hrms-uat.frevo.co.in/',
        ...activeWindow(),
        isActive: true,
      },
    });

    const client = await clientApiService.validatePublicClient(' gad ');

    expect(tenantResolverClient.post).toHaveBeenCalledWith(APP_CONFIG.tenantResolverUrl, {
      clientCode: 'GAD',
    });
    expect(client).toMatchObject({
      code: 'GAD',
      name: 'GA Digital',
      apiBaseUrl: 'http://api-hrms-uat.frevo.co.in',
      isActive: true,
    });
  });

  it('rejects an inactive or expired tenant', async () => {
    jest.spyOn(tenantResolverClient, 'post').mockResolvedValue({
      status: 200,
      data: {
        clientCode: 'GAD',
        apiBaseUrl: 'http://api-hrms-uat.frevo.co.in',
        validFromUtc: '2025-01-01T00:00:00Z',
        validUntilUtc: '2025-12-31T00:00:00Z',
        isActive: true,
      },
    });

    await expect(clientApiService.validatePublicClient('GAD')).rejects.toThrow(
      'INVALID_CLIENT_CODE',
    );
  });

  it('maps an unavailable client response to invalid client code', async () => {
    jest.spyOn(tenantResolverClient, 'post').mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 404,
        data: {
          code: 'TENANT_NOT_AVAILABLE',
          message: 'Client code is invalid or unavailable.',
        },
      },
    });

    await expect(clientApiService.validatePublicClient('UNKNOWN')).rejects.toThrow(
      'INVALID_CLIENT_CODE',
    );
  });

  it('routes HRMS requests through the selected tenant base URL', async () => {
    const window = activeWindow();
    sessionStorage.saveSelectedClient({
      code: 'GAD',
      name: 'GA Digital',
      supportEmail: '',
      apiBaseUrl: 'http://resolved-tenant.example',
      ...window,
      isActive: true,
      validatedAt: new Date().toISOString(),
      branding: {
        primaryColor: '#062B6F',
        accentColor: '#13BFA6',
        logoInitials: 'GAD',
        logoKey: 'gaDigital',
      },
    });
    let usedBaseUrl = '';

    await apiClient.get('/api/ess/profile', {
      adapter: async config => {
        usedBaseUrl = config.baseURL ?? '';
        return {
          data: {},
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      },
    });

    expect(usedBaseUrl).toBe('http://resolved-tenant.example');
  });
});

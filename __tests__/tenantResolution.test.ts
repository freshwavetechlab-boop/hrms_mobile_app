import { APP_CONFIG } from '../src/constants/app';
import {
  clientApiService,
  tenantResolverClient,
} from '../src/services/clientApiService';
import { apiClient } from '../src/services/apiClient';
import { sessionStorage } from '../src/services/sessionStorage';
import { clientRepository } from '../src/repositories/clientRepository';
import { networkService } from '../src/services/networkService';

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
    jest.spyOn(tenantResolverClient, 'get').mockResolvedValue({
      status: 200,
      data: {
        name: 'GA Digital Web Word Pvt. Ltd.',
        logoDataUrl: 'data:image/png;base64,ZmFrZQ==',
      },
    });

    const client = await clientApiService.validatePublicClient(' gad ');

    expect(tenantResolverClient.post).toHaveBeenCalledWith(APP_CONFIG.tenantResolverUrl, {
      clientCode: 'GAD',
    });
    expect(tenantResolverClient.get).toHaveBeenCalledWith(
      'http://api-hrms-uat.frevo.co.in/api/public/organization-brand',
    );
    expect(client).toMatchObject({
      code: 'GAD',
      name: 'GA Digital Web Word Pvt. Ltd.',
      apiBaseUrl: 'http://api-hrms-uat.frevo.co.in',
      isActive: true,
      branding: {
        logoDataUrl: 'data:image/png;base64,ZmFrZQ==',
      },
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

  it('refreshes a valid cached workspace on online startup', async () => {
    const window = activeWindow();
    const cached = {
      code: 'GAD',
      name: 'GA Digital',
      supportEmail: '',
      apiBaseUrl: 'http://old-endpoint.example',
      ...window,
      isActive: true,
      validatedAt: new Date().toISOString(),
      branding: {
        primaryColor: '#062B6F',
        accentColor: '#13BFA6',
        logoInitials: 'GAD',
      },
    };
    sessionStorage.saveSelectedClient(cached);
    jest.spyOn(networkService, 'fetch').mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    } as Awaited<ReturnType<typeof networkService.fetch>>);
    jest.spyOn(clientApiService, 'validatePublicClient').mockResolvedValue({
      ...cached,
      apiBaseUrl: 'http://new-endpoint.example',
    });

    const restored = await clientRepository.restoreClient();

    expect(restored?.apiBaseUrl).toBe('http://new-endpoint.example');
    expect(sessionStorage.getSelectedClient()?.apiBaseUrl).toBe('http://new-endpoint.example');
  });

  it('keeps a still-valid cached workspace when refresh is offline', async () => {
    const window = activeWindow();
    const cached = {
      code: 'GAD',
      name: 'GA Digital',
      supportEmail: '',
      apiBaseUrl: 'http://cached-endpoint.example',
      ...window,
      isActive: true,
      validatedAt: new Date().toISOString(),
      branding: {
        primaryColor: '#062B6F',
        accentColor: '#13BFA6',
        logoInitials: 'GAD',
      },
    };
    sessionStorage.saveSelectedClient(cached);
    jest.spyOn(networkService, 'fetch').mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as Awaited<ReturnType<typeof networkService.fetch>>);
    const resolver = jest.spyOn(clientApiService, 'validatePublicClient');

    const restored = await clientRepository.restoreClient();

    expect(restored).toEqual(cached);
    expect(resolver).not.toHaveBeenCalled();
  });
});

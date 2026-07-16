import { sessionStorage } from '../services/sessionStorage';
import { clientApiService } from '../services/clientApiService';
import { networkService } from '../services/networkService';
import { getErrorMessage } from '../utils/errorMessage';

const clientCodePattern = /^[A-Z0-9][A-Z0-9_-]{1,63}$/;

const isResolvedClientActive = (client: ReturnType<typeof sessionStorage.getSelectedClient>) => {
  if (!client?.apiBaseUrl || !client.validatedAt || client.isActive !== true) {
    return false;
  }
  const validFrom = Date.parse(client.validFromUtc);
  const validUntil = Date.parse(client.validUntilUtc);
  const now = Date.now();
  return (
    Number.isFinite(validFrom) &&
    Number.isFinite(validUntil) &&
    now >= validFrom &&
    now < validUntil
  );
};

export const clientRepository = {
  async restoreClient() {
    const selectedClient = sessionStorage.getSelectedClient();
    if (!selectedClient) {
      return undefined;
    }

    if (!clientCodePattern.test(selectedClient.code) || !isResolvedClientActive(selectedClient)) {
      sessionStorage.clearSelectedClient();
      return undefined;
    }

    try {
      const network = await networkService.fetch();
      const isOnline = Boolean(network.isConnected && network.isInternetReachable !== false);
      if (!isOnline) {
        return selectedClient;
      }
    } catch {
      return selectedClient;
    }

    try {
      const refreshedClient = await clientApiService.validatePublicClient(selectedClient.code);
      sessionStorage.saveSelectedClient(refreshedClient);
      return refreshedClient;
    } catch (error) {
      if (getErrorMessage(error) === 'INVALID_CLIENT_CODE') {
        sessionStorage.clearSelectedClient();
        return undefined;
      }
      // Resolver outages or malformed transient responses must not strand an
      // otherwise valid cached workspace while the employee is offline.
      return selectedClient;
    }
  },
  isApprovedClientCode(clientCode?: string) {
    const selectedClient = sessionStorage.getSelectedClient();
    return Boolean(
      clientCode &&
      clientCodePattern.test(clientCode) &&
      selectedClient?.code === clientCode.trim().toUpperCase() &&
      isResolvedClientActive(selectedClient),
    );
  },
  async validateClientCode(input: string) {
    const code = input.trim().toUpperCase();
    if (!clientCodePattern.test(code)) {
      throw new Error('INVALID_CLIENT_CODE');
    }

    const client = await clientApiService.validatePublicClient(code);
    sessionStorage.saveSelectedClient(client);
    return client;
  },
  clearClient() {
    sessionStorage.clearSelectedClient();
  },
};

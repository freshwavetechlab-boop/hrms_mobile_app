import { sessionStorage } from '../services/sessionStorage';
import { clientApiService } from '../services/clientApiService';

const clientCodePattern = /^[A-Z0-9-]{3,24}$/;

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
  restoreClient() {
    const selectedClient = sessionStorage.getSelectedClient();
    if (!selectedClient) {
      return undefined;
    }

    if (!clientCodePattern.test(selectedClient.code) || !isResolvedClientActive(selectedClient)) {
      sessionStorage.clearSelectedClient();
      return undefined;
    }

    return selectedClient;
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

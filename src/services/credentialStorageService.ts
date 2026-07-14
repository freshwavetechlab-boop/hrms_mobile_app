import * as Keychain from 'react-native-keychain';

export type SavedLoginCredentials = {
  email: string;
  password: string;
};

const serviceForClient = (clientCode: string) =>
  `com.frevone.hrms.login.${clientCode.trim().toLowerCase().replace(/[^a-z0-9.-]/g, '-')}`;

export const credentialStorageService = {
  async save(clientCode: string, credentials: SavedLoginCredentials) {
    const result = await Keychain.setGenericPassword(
      credentials.email.trim(),
      credentials.password,
      {
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        service: serviceForClient(clientCode),
      },
    );

    if (!result) {
      throw new Error('CREDENTIAL_SAVE_FAILED');
    }
  },

  async load(clientCode: string): Promise<SavedLoginCredentials | undefined> {
    const credentials = await Keychain.getGenericPassword({
      service: serviceForClient(clientCode),
    });

    if (!credentials) {
      return undefined;
    }

    return {
      email: credentials.username,
      password: credentials.password,
    };
  },

  async clear(clientCode: string) {
    await Keychain.resetGenericPassword({ service: serviceForClient(clientCode) });
  },
};

/* eslint-env jest */

import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-mmkv', () => {
  const values = new Map();
  return {
    createMMKV: () => ({
      set: (key, value) => values.set(key, value),
      getString: key => values.get(key),
      getBoolean: key => values.get(key),
      remove: key => values.delete(key),
    }),
  };
});

jest.mock('react-native-quick-sqlite', () => ({
  open: jest.fn(() => ({
    executeAsync: jest.fn(() =>
      Promise.resolve({
        rowsAffected: 0,
        rows: {
          _array: [],
          length: 0,
          item: jest.fn(),
        },
      }),
    ),
  })),
}));

jest.mock('react-native-biometrics', () =>
  jest.fn().mockImplementation(() => ({
    isSensorAvailable: jest.fn(() => Promise.resolve({ available: false })),
    simplePrompt: jest.fn(() => Promise.resolve({ success: true })),
  })),
);

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly',
  },
  setGenericPassword: jest.fn(() => Promise.resolve({ service: 'test', storage: 'test' })),
  getGenericPassword: jest.fn(() => Promise.resolve(false)),
  resetGenericPassword: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn(),
}));

jest.mock('react-native-nitro-image', () => ({
  loadImage: jest.fn(() =>
    Promise.resolve({
      resizeAsync: jest.fn(() =>
        Promise.resolve({
          toRawPixelDataAsync: jest.fn(() =>
            Promise.resolve({
              buffer: new Uint8Array(9 * 8 * 4).fill(127).buffer,
              width: 9,
              height: 8,
              pixelFormat: 'RGBA',
            }),
          ),
        }),
      ),
    }),
  ),
}));

jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    ANDROID: {
      CAMERA: 'android.permission.CAMERA',
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    },
    IOS: {
      CAMERA: 'ios.permission.CAMERA',
      LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    LIMITED: 'limited',
  },
  request: jest.fn(() => Promise.resolve('granted')),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    }),
  ),
}));

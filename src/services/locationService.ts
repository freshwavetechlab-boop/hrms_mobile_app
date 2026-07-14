import { Linking, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

export type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  mocked: boolean;
  provider?: string;
};

export const locationService = {
  getCurrentPosition() {
    return new Promise<DeviceLocation>((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: Math.max(0, Math.round(position.coords.accuracy ?? 0)),
            mocked: Boolean(position.mocked),
            provider: position.provider,
          }),
        reject,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      );
    });
  },
  async openLocationSettings() {
    if (Platform.OS === 'android') {
      try {
        await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
        return;
      } catch {
        await Linking.openSettings();
        return;
      }
    }

    await Linking.openSettings();
  },
  isLocationUnavailableError(error: unknown) {
    if (typeof error === 'object' && error !== null) {
      const maybeError = error as { code?: unknown; message?: unknown };
      if ([1, 2, 3, 4, 5].includes(Number(maybeError.code))) {
        return true;
      }
      if (
        typeof maybeError.message === 'string' &&
        /location|provider|gps|disabled|unavailable|timeout|permission|play service/i.test(maybeError.message)
      ) {
        return true;
      }
    }

    return false;
  },
  isLocationSettingsDisabledError(error: unknown) {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const maybeError = error as { code?: unknown; message?: unknown };
    if (Number(maybeError.code) === 5) {
      return true;
    }

    return (
      typeof maybeError.message === 'string' &&
      /settings not satisfied|location service is not enabled|gps (?:is )?off|location (?:is )?disabled/i.test(
        maybeError.message,
      )
    );
  },
};

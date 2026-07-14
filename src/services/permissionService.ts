import { Platform } from 'react-native';
import { PERMISSIONS, RESULTS, request } from 'react-native-permissions';

export const permissionService = {
  async requestCamera() {
    const permission = Platform.select({
      android: PERMISSIONS.ANDROID.CAMERA,
      ios: PERMISSIONS.IOS.CAMERA,
    });
    if (!permission) {
      return false;
    }
    const result = await request(permission);
    return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
  },
  async requestLocation() {
    const permission = Platform.select({
      android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
    });
    if (!permission) {
      return false;
    }
    const result = await request(permission);
    return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
  },
};

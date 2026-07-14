import { locationService } from './locationService';
import { permissionService } from './permissionService';

export const MOCK_LOCATION_MESSAGE =
  "Mock location detected. Kindly uninstall Fly GPS or any mock location app and disable mock location; otherwise you won't be able to login.";

export const locationIntegrityService = {
  async assertTrustedLoginLocation() {
    const granted = await permissionService.requestLocation();
    if (!granted) {
      throw new Error('LOCATION_PERMISSION_REQUIRED');
    }

    let location;
    try {
      location = await locationService.getCurrentPosition();
    } catch (error) {
      if (locationService.isLocationSettingsDisabledError(error)) {
        throw new Error('LOCATION_SETTINGS_DISABLED');
      }
      if (locationService.isLocationUnavailableError(error)) {
        throw new Error('LOCATION_SECURITY_REQUIRED');
      }
      throw error;
    }
    if (location.mocked) {
      throw new Error('MOCK_LOCATION_DETECTED');
    }

    return location;
  },
  async isMockLocationActive() {
    const location = await locationService.getCurrentPosition();
    return location.mocked;
  },
};

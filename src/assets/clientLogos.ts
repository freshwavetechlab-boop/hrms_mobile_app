import { ImageSourcePropType } from 'react-native';
import { ClientLogoKey } from '../types/domain';

export const clientLogos: Record<ClientLogoKey, ImageSourcePropType> = {
  gaDigital: require('./client-logos/ga-digital.jpeg'),
  frevone: require('./client-logos/frevone.jpeg'),
};

export const getClientLogo = (logoKey?: ClientLogoKey) =>
  logoKey ? clientLogos[logoKey] : undefined;

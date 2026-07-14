const palette = {
  primary: '#175CD3',
  primaryDark: '#123C8C',
  primarySoft: '#E8F1FF',
  secondary: '#008577',
  secondarySoft: '#DFF7F3',
  accent: '#B54708',
  accentSoft: '#FFF3E3',
  success: '#027A48',
  successSoft: '#D1FADF',
  warning: '#B42318',
  warningSoft: '#FEE4E2',
  surface: '#FFFFFF',
  surfaceMuted: '#F4F7FB',
  surfaceRaised: '#FAFCFF',
  border: '#D0D7E2',
  text: '#172033',
  textMuted: '#5B667A',
  shadow: '#101828',
};

export type AppColors = { [Key in keyof typeof palette]: string };

export const lightColors: AppColors = palette;

export const darkColors: AppColors = {
  primary: '#76A9FA',
  primaryDark: '#123C8C',
  primarySoft: '#193A66',
  secondary: '#4FD1C5',
  secondarySoft: '#123F3C',
  accent: '#FDBA74',
  accentSoft: '#4A2C14',
  success: '#6CE9A6',
  successSoft: '#164C35',
  warning: '#FDA29B',
  warningSoft: '#551E1B',
  surface: '#182230',
  surfaceMuted: '#101828',
  surfaceRaised: '#202B3C',
  border: '#344054',
  text: '#F2F4F7',
  textMuted: '#B8C0CC',
  shadow: '#000000',
};

// Static brand surfaces use this alias. Runtime UI uses useAppColors().
export const colors = lightColors;

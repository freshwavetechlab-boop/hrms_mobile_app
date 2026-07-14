import { useEffect } from 'react';
import { useAppSelector } from '../store/hooks';
import { setLocale, t } from './i18n';

export const useTranslation = () => {
  const locale = useAppSelector(state => state.preferences.locale);

  useEffect(() => {
    setLocale(locale);
  }, [locale]);

  return { locale, t };
};

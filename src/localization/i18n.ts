import { en } from './en';

type Messages = typeof en;
export type TranslationKey = keyof Messages;

const dictionaries: Record<string, Messages> = {
  en,
};

let currentLocale = 'en';

export const setLocale = (locale: string) => {
  currentLocale = dictionaries[locale] ? locale : 'en';
};

export const t = (key: TranslationKey) => dictionaries[currentLocale][key];

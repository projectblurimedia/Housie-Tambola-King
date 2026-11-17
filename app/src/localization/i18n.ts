import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './en.json';
import te from './te.json';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from './languages';

// Hermes may lack Intl.PluralRules; Telugu has its own plural rules, so polyfill (NearbyU does the same).
if (typeof Intl === 'undefined' || typeof (Intl as { PluralRules?: unknown }).PluralRules === 'undefined') {
  require('@formatjs/intl-pluralrules/polyfill.js');
  require('@formatjs/intl-pluralrules/locale-data/en.js');
  require('@formatjs/intl-pluralrules/locale-data/te.js');
}

export { SUPPORTED_LANGUAGES };
export type { SupportedLanguage };

const device = Localization.getLocales()[0]?.languageCode ?? 'en';
export const deviceLanguage: SupportedLanguage = (SUPPORTED_LANGUAGES as readonly string[]).includes(device)
  ? (device as SupportedLanguage)
  : 'en';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, te: { translation: te } },
  lng: deviceLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;

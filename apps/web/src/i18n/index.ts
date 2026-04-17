import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/common.json';
import enAttendanceReporting from './locales/en/attendance-reporting.json';
import tr from './locales/tr/common.json';
import trAttendanceReporting from './locales/tr/attendance-reporting.json';

function deepMerge<T extends Record<string, unknown>>(base: T, extension: Record<string, unknown>): T {
  const output: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(extension)) {
    const existing = output[key];
    if (
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing) &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      output[key] = deepMerge(existing as Record<string, unknown>, value as Record<string, unknown>);
      continue;
    }
    output[key] = value;
  }
  return output as T;
}

const enMerged = deepMerge(en, enAttendanceReporting);
const trMerged = deepMerge(tr, trAttendanceReporting);

export const defaultNS = 'common';
export const resources = {
  en: { common: enMerged },
  tr: { common: trMerged },
} as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'tr'],
    defaultNS,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'amateur.locale',
    },
  });

export default i18n;

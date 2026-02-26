import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getInitialLocale, I18N_LOCALES, type I18nLocale } from '@forgeon/i18n-web';
import enCommon from '../../../resources/i18n/en/common.json';
import enErrors from '../../../resources/i18n/en/errors.json';
import enValidation from '../../../resources/i18n/en/validation.json';

const resources = {
  en: {
    common: enCommon,
    errors: enErrors,
    validation: enValidation,
  },
} as const;

const fallbackLocale = (I18N_LOCALES[0] ?? 'en') as I18nLocale;

void i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLocale(),
  fallbackLng: fallbackLocale,
  interpolation: {
    escapeValue: false,
  },
  defaultNS: 'common',
});

export default i18n;

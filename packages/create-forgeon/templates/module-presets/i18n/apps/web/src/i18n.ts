import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18N_DEFAULT_LANG } from '@forgeon/i18n-contracts';
import { getInitialLocale } from '@forgeon/i18n-web';
import enCommon from '../../../../resources/i18n/en/common.json';
import enErrors from '../../../../resources/i18n/en/errors.json';
import enValidation from '../../../../resources/i18n/en/validation.json';
import ukCommon from '../../../../resources/i18n/uk/common.json';
import ukErrors from '../../../../resources/i18n/uk/errors.json';
import ukValidation from '../../../../resources/i18n/uk/validation.json';

const resources = {
  en: {
    common: enCommon,
    errors: enErrors,
    validation: enValidation,
  },
  uk: {
    common: ukCommon,
    errors: ukErrors,
    validation: ukValidation,
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLocale(),
  fallbackLng: I18N_DEFAULT_LANG,
  interpolation: {
    escapeValue: false,
  },
  defaultNS: 'common',
});

export default i18n;

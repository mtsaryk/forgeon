import { registerAs } from '@nestjs/config';
import { parseI18nEnv } from './i18n-env.schema';

export const I18N_CONFIG_NAMESPACE = 'i18n';

export interface I18nConfigValues {
  defaultLang: string;
  fallbackLang: string;
}

export const i18nConfig = registerAs(
  I18N_CONFIG_NAMESPACE,
  (): I18nConfigValues => {
    const env = parseI18nEnv(process.env);
    return {
      defaultLang: env.I18N_DEFAULT_LANG,
      fallbackLang: env.I18N_FALLBACK_LANG,
    };
  },
);

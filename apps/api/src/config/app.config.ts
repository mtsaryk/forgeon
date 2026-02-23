import { registerAs } from '@nestjs/config';

const toBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
};

export default registerAs('app', () => ({
  port: Number(process.env.PORT ?? 3000),
  i18nEnabled: toBoolean(process.env.I18N_ENABLED, true),
  i18nDefaultLang: process.env.I18N_DEFAULT_LANG ?? 'en',
  i18nFallbackLang: process.env.I18N_FALLBACK_LANG ?? 'en',
}));

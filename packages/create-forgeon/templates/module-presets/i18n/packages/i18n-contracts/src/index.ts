export const I18N_LOCALES = ['en', 'uk'] as const;

export type I18nLocale = (typeof I18N_LOCALES)[number];

export const I18N_DEFAULT_LANG: I18nLocale = 'en';
export const I18N_FALLBACK_LANG: I18nLocale = 'en';
export const LANG_QUERY_PARAM = 'lang';

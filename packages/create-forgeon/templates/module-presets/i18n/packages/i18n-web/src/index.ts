import {
  I18N_DEFAULT_LANG,
  I18N_LOCALES,
  LANG_QUERY_PARAM,
  type I18nLocale,
} from '@forgeon/i18n-contracts';

const LOCALE_STORAGE_KEY = 'forgeon.locale';

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function getStorage(): StorageLike | undefined {
  if (typeof globalThis !== 'object' || globalThis === null) {
    return undefined;
  }

  const candidate = (globalThis as { localStorage?: StorageLike }).localStorage;
  if (!candidate || typeof candidate.getItem !== 'function' || typeof candidate.setItem !== 'function') {
    return undefined;
  }

  return candidate;
}

function isSupportedLocale(value: string): value is I18nLocale {
  return I18N_LOCALES.includes(value as I18nLocale);
}

export function getInitialLocale(): I18nLocale {
  const storage = getStorage();
  const stored = storage?.getItem(LOCALE_STORAGE_KEY);
  if (stored && isSupportedLocale(stored)) {
    return stored;
  }
  return I18N_DEFAULT_LANG;
}

export function persistLocale(locale: I18nLocale): void {
  const storage = getStorage();
  storage?.setItem(LOCALE_STORAGE_KEY, locale);
}

export function toLangQuery(locale: I18nLocale): string {
  return `?${LANG_QUERY_PARAM}=${encodeURIComponent(locale)}`;
}

export { I18N_LOCALES, type I18nLocale };

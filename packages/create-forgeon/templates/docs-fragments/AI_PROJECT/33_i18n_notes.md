### i18n Notes

- i18n is enabled when the module is installed via scaffold/add flow.
- Default/fallback are controlled by `I18N_DEFAULT_LANG` and `I18N_FALLBACK_LANG`.
- Locale contracts (`I18N_LOCALES`, `I18N_NAMESPACES`) are generated from `resources/i18n/*` via `pnpm i18n:sync`.
- Contract validation is available via `pnpm i18n:check`.
- Translation key type generation is available via `pnpm i18n:types`.
- Frontend helpers live in `@forgeon/i18n-web`.

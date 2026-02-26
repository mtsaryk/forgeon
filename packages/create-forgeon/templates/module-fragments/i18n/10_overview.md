## Overview

Adds optional i18n support across backend and frontend.

Included parts:
- `@forgeon/i18n` (NestJS i18n integration package)
- `@forgeon/i18n-contracts` (generated locale/namespace contracts + checks/types scripts)
- `@forgeon/i18n-web` (React-side locale helpers)
- `react-i18next` integration for frontend translations
- shared dictionaries in `resources/i18n/*` (`en` by default) used by both API and web

Utility commands:
- `pnpm i18n:sync` - regenerate `I18N_LOCALES` and `I18N_NAMESPACES` from `resources/i18n`.
- `pnpm i18n:check` - verify generated contracts, JSON validity, and missing/extra keys vs fallback locale.
- `pnpm i18n:types` - generate translation key type unions for autocomplete.
- `pnpm i18n:add <locale>` - create `resources/i18n/<locale>` from `--copy-from` namespace files.

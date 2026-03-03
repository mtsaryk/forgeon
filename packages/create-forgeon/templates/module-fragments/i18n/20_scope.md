## Applied Scope

- API module wiring (`AppModule`, config, filter, health endpoint translation)
- API package/deps/scripts updates
- Docker env + compose i18n env keys
- Frontend `react-i18next` setup (`apps/web/src/i18n.ts`)
- Frontend language selector and translated UI in `apps/web/src/App.tsx`
- Frontend package/deps/scripts updates for i18n helpers
- Root scripts:
- `i18n:sync` for locale/namespace contracts sync from `resources/i18n`
- `i18n:check` for contract/json/key consistency checks
- `i18n:types` for translation key type generation
- `i18n:add` for adding a new locale from the command line

Operational notes:

- this module owns the i18n helper commands
- it does not use integration sync groups today because its work is self-contained within the localization stack

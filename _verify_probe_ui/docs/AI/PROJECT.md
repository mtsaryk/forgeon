# PROJECT

## What This Repository Is

A canonical fullstack monorepo scaffold intended to be reused as a project starter.

## Structure
- `apps/api` - NestJS backend
- `apps/web` - React frontend (`React + Vite + TypeScript`, fixed)
- `packages/core` - shared backend core package (`core-config`, `core-errors`, `core-validation`)
- `packages/db-prisma` - DB module (`DbPrismaModule`, Prisma service + config)
- `packages/i18n` - reusable nestjs-i18n integration package
- `packages/i18n-contracts` - shared locale/query constants
- `packages/i18n-web` - frontend locale helper package
- `resources/i18n` - translation dictionaries
- `infra` - Docker Compose (always) + proxy preset (`caddy`)
- `docs` - documentation, AI prompts, and module spec contracts

## Run Modes

### Dev mode

```bash
pnpm install
pnpm dev
```

### Docker mode

```bash
docker compose --env-file infra/docker/.env.example -f infra/docker/compose.yml up --build
```

### Proxy Notes
- Active proxy preset: `caddy`
- Main proxy config: `infra/caddy/Caddyfile`
- Keep service names `api` and `db` stable unless you update compose and proxy config together.

### i18n Notes
- i18n is enabled when the module is installed via scaffold/add flow.
- Default/fallback are controlled by `I18N_DEFAULT_LANG` and `I18N_FALLBACK_LANG`.
- Locale contracts (`I18N_LOCALES`, `I18N_NAMESPACES`) are generated from `resources/i18n/*` via `pnpm i18n:sync`.
- Contract validation is available via `pnpm i18n:check`.
- Translation key type generation is available via `pnpm i18n:types`.
- Frontend helpers live in `@forgeon/i18n-web`.

### Error Handling

`core-errors` is enabled by default.
- `CoreErrorsModule` is imported in `apps/api/src/app.module.ts`.
- `CoreExceptionFilter` is registered globally in `apps/api/src/main.ts`.
- Controllers and services should throw standard Nest exceptions; envelope formatting is handled centrally.

## Change Boundaries
- Safe to change first: env files, host ports, and app code under `apps/*`.
- Change carefully: proxy config and docker service names because routing depends on them.

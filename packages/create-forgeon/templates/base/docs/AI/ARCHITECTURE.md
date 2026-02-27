# ARCHITECTURE

## Monorepo Layout

- `apps/*` - deployable apps
- `packages/*` - reusable modules/presets
- `infra/*` - runtime infrastructure
- `resources/*` - static assets (translations)

Canonical stack is fixed in this stage:
- NestJS + React + Prisma/Postgres + Docker
- Proxy preset can be `caddy`, `nginx`, or `none`

## Environment Flags

- `PORT` - API port (default 3000)
- `API_PREFIX` - global API prefix (default `api`)
- `DATABASE_URL` - Prisma Postgres connection
- `I18N_DEFAULT_LANG` - default language
- `I18N_FALLBACK_LANG` - fallback language

## Config Strategy

- `@forgeon/core` owns base runtime config, global error envelope/filter, and validation pipe defaults.
- Core config is validated with Zod and exposed through typed accessors.
- Add-modules own and validate only their module-specific env keys.
- i18n is an add-module; when installed, it uses its own env keys.

## Default DB Stack

Current default is Prisma + Postgres.

- Prisma schema and migrations live in `apps/api/prisma`
- DB access is encapsulated via `DbPrismaModule` in `@forgeon/db-prisma`
- `db-prisma` is treated as default-applied behavior in scaffold generation.
- Future direction: this default DB layer may be extracted to an explicit add-module/preset and optionally controlled by a CLI flag.
- Additional DB presets are out of scope for the current milestone.

## Module Strategy

Reusable features should be added as fullstack add-modules:

- `contracts` package (shared DTO/routes/errors)
- `api` package (NestJS integration)
- `web` package (React integration)

Reference: `docs/AI/MODULE_SPEC.md`.

## Integration Sync Strategy

- Integration orchestration is a default project toolchain command:
  - `pnpm forgeon:sync-integrations`
- Purpose:
  - keep add-modules composable when installed in arbitrary order;
  - apply module-to-module integration patches idempotently.
- Rule:
  - each add-module patches only itself;
  - cross-module changes are allowed only in integration sync rules.
- Current integration:
  - `jwt-auth + db-prisma` (persistent refresh-token store wiring + schema/migration sync).
- Pair sync is explicit (opt-in), not automatic after `add`.
- Run `pnpm forgeon:sync-integrations` when you want to apply module-pair integrations.
- Swagger auth decorators are intentionally not auto-patched.
- Future option: this may return as an explicit optional command (not default automatic behavior).

## TypeScript Module Format Policy

- `apps/api`, `packages/core`, and backend runtime packages use Node-oriented config:
  - `tsconfig.base.node.json`
- Frontend-consumed shared packages (especially contracts/web helpers) use ESM config:
  - `tsconfig.base.esm.json`
- Contracts packages are ESM-first and imported via package entrypoints only.
- Cross-package imports from `/src/*` are disallowed.

## Error Handling Strategy

- `@forgeon/core` owns the global HTTP error envelope and filter.
- API apps import `CoreErrorsModule` and register `CoreExceptionFilter` globally.
- Envelope fields:
  - `error.code`
  - `error.message`
  - `error.status`
  - `error.details` (optional)
  - `error.requestId` (optional)
  - `error.timestamp`

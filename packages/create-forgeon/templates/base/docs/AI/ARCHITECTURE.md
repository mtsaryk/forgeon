# ARCHITECTURE

## Monorepo Layout

- `apps/*` - deployable apps
- `packages/*` - reusable modules/presets
- `infra/*` - runtime infrastructure
- `resources/*` - static assets (translations)

## Environment Flags

- `PORT` - API port (default 3000)
- `DATABASE_URL` - Prisma Postgres connection
- `I18N_ENABLED` - toggles i18n package wiring
- `I18N_DEFAULT_LANG` - default language
- `I18N_FALLBACK_LANG` - fallback language

## Default DB Stack

Current default is Prisma + Postgres.

- Prisma schema and migrations live in `apps/api/prisma`
- DB access is encapsulated via `PrismaModule` (`apps/api/src/prisma`)

## Future DB Presets (Not Implemented Yet)

A future preset can switch DB by:
1. Replacing `PrismaModule` with another DB module package (for example Mongo package).
2. Updating `infra/docker/compose.yml` DB service.
3. Updating `DATABASE_URL` and related env keys.
4. Keeping app-level services dependent only on repository/data-access abstractions.

## Future Feature Modules

Reusable features should be added as workspace packages and imported by apps as needed:

- `packages/core` for shared backend primitives
- Additional packages for auth presets, guards, queues, mailers, etc.

## TypeScript Module Format Policy

- `apps/api`, `packages/core`, and backend runtime packages use `tsconfig.base.node.json`.
- Frontend-consumed shared packages (contracts/web helpers) use `tsconfig.base.esm.json`.
- Contracts packages are ESM-first and imported only via package entrypoints.
- Cross-package imports from `/src/*` are disallowed.

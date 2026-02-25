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

- `@forgeon/core` owns base runtime config (port, API prefix, node env).
- Core config is validated with Zod and exposed through typed accessors.
- Add-modules own and validate only their module-specific env keys.
- i18n is an add-module; when installed, it uses its own env keys.

## Default DB Stack

Current default is Prisma + Postgres.

- Prisma schema and migrations live in `apps/api/prisma`
- DB access is encapsulated via `PrismaModule` (`apps/api/src/prisma`)
- Additional DB presets are out of scope for the current milestone.

## Module Strategy

Reusable features should be added as fullstack add-modules:

- `contracts` package (shared DTO/routes/errors)
- `api` package (NestJS integration)
- `web` package (React integration)

Reference: `docs/AI/MODULE_SPEC.md`.

## TypeScript Module Format Policy

- `apps/api`, `packages/core`, and backend runtime packages use Node-oriented config:
  - `tsconfig.base.node.json`
- Frontend-consumed shared packages (especially contracts/web helpers) use ESM config:
  - `tsconfig.base.esm.json`
- Contracts packages are ESM-first and imported via package entrypoints only.
- Cross-package imports from `/src/*` are disallowed.

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
- `DATABASE_URL` - Prisma Postgres connection
- `I18N_ENABLED` - toggles i18n package wiring
- `I18N_DEFAULT_LANG` - default language
- `I18N_FALLBACK_LANG` - fallback language

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

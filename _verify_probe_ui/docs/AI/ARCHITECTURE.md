# ARCHITECTURE

## Monorepo Layout
- `apps/*` - deployable apps
- `packages/*` - reusable modules and presets

Canonical stack is fixed for now: NestJS API + React web + Prisma/Postgres + Docker.
- `infra/*` - runtime infrastructure (compose, proxy, env examples)
- `resources/*` - static assets (includes translation dictionaries when i18n is enabled)

## Environment Flags
- `PORT` - API port (default 3000)
- `API_PREFIX` - global API prefix (default `api`)

## Config Strategy
- `@forgeon/core` owns base runtime config, global error envelope/filter, and validation pipe defaults.
- Core config is validated with Zod and exposed through typed accessors.
- Add-modules own and validate only their module-specific env keys.
- `DATABASE_URL` - DB connection string for Prisma
- `I18N_DEFAULT_LANG` - default language
- `I18N_FALLBACK_LANG` - fallback language

## TypeScript Module Policy
- Keep app/runtime packages on Node config (`tsconfig.base.node.json`) when they run under NestJS/Node.
- Keep frontend-consumed shared packages on ESM config (`tsconfig.base.esm.json`).
- Contracts packages (`@forgeon/<feature>-contracts`) are ESM-first and imported only via package entrypoint.
- Do not import workspace internals via `/src/*` paths across packages.

## Error Handling Strategy
- `@forgeon/core` owns the global HTTP error envelope.
- API apps import `CoreErrorsModule` and register `CoreExceptionFilter` as a global filter.
- Envelope fields:
  - `error.code`
  - `error.message`
  - `error.status`
  - `error.details` (optional, mainly validation context)
  - `error.requestId` (optional, derived from `x-request-id`)
  - `error.timestamp`

## Default DB Stack

Current default stack is `Prisma + PostgreSQL`.
- Prisma schema and migrations live in `apps/api/prisma`
- DB access is encapsulated via `DbPrismaModule` in `@forgeon/db-prisma`
- `db-prisma` is a full add-module and is enabled by default during scaffold generation (`db-prisma=true`).
- It can be disabled at generation time and added later via `create-forgeon add db-prisma --project .`.
- Additional DB presets are intentionally out of scope for the current milestone.

## Docker Runtime Flow
- Compose file: `infra/docker/compose.yml`
- API starts through migration deploy, then NestJS server boot.
- Active reverse proxy preset: `caddy` (`infra/caddy/Caddyfile`)

## Scope Freeze (Current)
- Frontend preset selection is disabled (React is fixed).
- DB preset selection is disabled (Prisma/Postgres is fixed).
- Docker is always generated; runtime proxy is selectable (`caddy|nginx|none`).
- DB preset flags may return in a future milestone after `db-prisma` is separated into an explicit preset/module flow.

## Docs Generation Pipeline

Project docs are assembled from markdown fragments in:
- `packages/create-forgeon/templates/docs-fragments/README`
- `packages/create-forgeon/templates/docs-fragments/AI_PROJECT`
- `packages/create-forgeon/templates/docs-fragments/AI_ARCHITECTURE`

During scaffold generation, the CLI selects fragments based on chosen flags and writes final docs into project root and `docs/AI`.

## Extension Points

Future presets should extend both code and docs in parallel:

1. Add or update fullstack module templates (`contracts/api/web`).
2. Register modules in `create-forgeon add` registry.
3. Add module docs fragments and update module spec docs.
4. Keep canonical core stack stable unless a major version changes it.

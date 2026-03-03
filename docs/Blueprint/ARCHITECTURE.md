# ARCHITECTURE

## Monorepo Layout

- `apps/*` - deployable apps
- `packages/*` - reusable modules/presets
- `infra/*` - runtime infrastructure
- `resources/*` - static assets (translations)

Canonical stack is fixed in this stage:
- NestJS + React + Docker
- Proxy preset can be `caddy`, `nginx`, or `none`
- DB module `db-prisma` is default-on, but can be disabled at scaffold time

## Environment Flags

- `PORT` - API port (default 3000)
- `API_PREFIX` - global API prefix (default `api`)
- `I18N_DEFAULT_LANG` - default language
- `I18N_FALLBACK_LANG` - fallback language

Module-owned env:
- `DATABASE_URL` - added by `db-prisma`

## Config Strategy

- `@forgeon/core` owns base runtime config, global error envelope/filter, and validation pipe defaults.
- Core config is validated with Zod and exposed through typed accessors.
- Add-modules own and validate only their module-specific env keys.
- i18n is an add-module; when installed, it uses its own env keys.

## Default DB Stack

Current default DB module is Prisma + Postgres (`db-prisma`).

- Prisma schema and migrations live in `apps/api/prisma`
- DB access is encapsulated via `DbPrismaModule` in `@forgeon/db-prisma`
- `db-prisma` is default-applied during scaffold generation (`db-prisma=true`) and can be skipped (`db-prisma=false`).
- Projects generated without DB can add it later: `create-forgeon add db-prisma --project .`
- Additional DB presets are out of scope for the current milestone.

## Module Strategy

Reusable features should be added as fullstack add-modules:

- `contracts` package (shared DTO/routes/errors)
- `api` package (NestJS integration)
- `web` package (React integration)

Reference: `docs/Blueprint/MODULE_SPEC.md`.

Dependency resolution reference: `docs/Blueprint/DEPENDENCY_DOCTRINE.md`.

## Integration Sync Strategy

- Integration orchestration is a default project toolchain command:
  - `pnpm forgeon:sync-integrations`
- Purpose:
  - keep add-modules composable when installed in arbitrary order;
  - apply module-to-module integration patches idempotently.
- Rule:
  - each add-module patches only itself;
  - cross-module changes are allowed only in integration sync rules.
- Current integrations:
  - `jwt-auth + db-prisma` (persistent refresh-token store wiring + schema/migration sync)
  - `jwt-auth + rbac` (demo RBAC claims wiring in auth contracts and payloads)
- `create-forgeon add <module>` scans only the relevant pending integration groups and offers them interactively.
- Integrations are never applied silently; users can apply them from the prompt or later with `pnpm forgeon:sync-integrations`.
- Swagger auth decorators are intentionally not auto-patched.
- Future option: this may return as an explicit optional command (not default automatic behavior).

## Dependency Resolution Strategy

Module dependency handling is capability-driven.

Canonical rules:

- hard prerequisites are expressed as capabilities whenever possible
- provider modules declare which capabilities they provide
- the CLI resolves missing prerequisites explicitly

TTY behavior:

- detect missing hard prerequisite
- if it is a capability, ask the user to choose a provider
- after provider resolution, show a concrete install plan
- execute only after explicit confirmation

Non-TTY behavior:

- fail by default when a hard prerequisite is missing
- allow explicit recursive prerequisite install only with:
  - `--with-required`
- require explicit provider mapping for ambiguous capabilities:
  - `--provider <capability>=<module>`

Silent dependency installation is not allowed.

Optional integrations:

- do not block installation
- are announced as explicit follow-up opportunities
- should include a short human-readable benefit summary and exact follow-up commands

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

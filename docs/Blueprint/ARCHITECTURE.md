# ARCHITECTURE

This file describes Forgeon's internal generator/scaffold architecture. It is not generated-project end-user documentation.

## Monorepo Layout

- `apps/*` - internal development harness apps and scaffold substrate
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

Forgeon is a generator monorepo that keeps reusable feature implementations in one place so generated projects can install common product features with one command.

The primary goal is to centralize reusable features that recur across our products in one internal workspace, then expose them through scaffold generation and `create-forgeon add <module>`.

These reusable features are feature-first, not fullstack-by-default. They may represent:

- backend infrastructure or runtime services
- frontend product surfaces such as themes or UI kits
- shared feature contracts and integrations across backend and frontend
- domain-oriented product capabilities such as auth, validation, files, or i18n

A module may be:

- backend-only
- web-only
- fullstack

Use a fullstack split only when backend and frontend both need first-class support for the same reusable feature and should share a stable contract.

In that case, the canonical shape is:

- `contracts` package (shared DTO/routes/errors/constants)
- `api` package (NestJS integration)
- `web` package (React integration)

Reference: `docs/Blueprint/MODULE_SPEC.md`.

Dependency resolution reference: `docs/Blueprint/DEPENDENCY_DOCTRINE.md`.

## Integration Sync Strategy

- In generated projects, integration orchestration is exposed as a toolchain command:
  - `pnpm forgeon:sync-integrations`
- this script is part of scaffolded project output; the root development repo may use a different script surface
- Purpose:
  - keep add-modules composable when installed in arbitrary order;
  - apply module-to-module integration patches idempotently.
- Rule:
  - each add-module patches only itself;
  - cross-module changes are allowed only in integration sync rules.
- Current integrations:
  - `jwt-auth + db-adapter` (current provider: `db-prisma`; persistent refresh-token store wiring + schema/migration sync)
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



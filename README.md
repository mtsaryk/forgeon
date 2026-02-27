# Forgeon Fullstack Scaffold

Canonical monorepo scaffold focused on one stable stack:

- NestJS API
- React + Vite web
- Docker runtime (always generated)
- Proxy preset: `caddy` (default), `nginx`, or `none`
- DB layer: `db-prisma` add-module (enabled by default, can be disabled at scaffold time)

Current release line: `0.1.0`.

## Quick Start (Dev)

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Start local Postgres:
   ```bash
   docker compose --env-file infra/docker/.env.example -f infra/docker/compose.yml up db -d
   ```
   Skip this step if project was generated with `--db-prisma false`.
3. Run API + web in dev mode:
   ```bash
   pnpm dev
   ```

## Quick Start (Docker)

```bash
docker compose --env-file infra/docker/.env.example -f infra/docker/compose.yml up --build
```

- `proxy=caddy|nginx`: open `http://localhost:8080`
- `proxy=none`: API at `http://localhost:3000/api/health`, web via `pnpm dev`

## Generator

```bash
npx create-forgeon@latest my-app --i18n true --db-prisma true --proxy caddy
npx create-forgeon@latest my-app --db-prisma false --proxy caddy
```

Local invocation:

```bash
pnpm create:forgeon -- my-app --i18n true --proxy caddy
```

## Add Modules

```bash
npx create-forgeon@latest add --list
npx create-forgeon@latest add i18n --project ./my-app
npx create-forgeon@latest add jwt-auth --project ./my-app
```

## Integration Sync

After installing modules in any order, run:

```bash
pnpm forgeon:sync-integrations
```

Current sync rule:
- `jwt-auth + swagger`: auto-applies Swagger decorators to auth controller and DTOs.

`create-forgeon add <module>` triggers sync automatically as best-effort.

## Validation (`core-validation`)

Validation is centralized in `@forgeon/core` via `createValidationPipe()`.

- Registered globally in `apps/api/src/main.ts`
- Default options: `whitelist: true`, `transform: true`
- Validation errors are normalized into structured `error.details`

Use standard `class-validator` decorators in DTOs; the global pipe and envelope formatting are applied automatically.

## Docs

- Project docs index: `docs/README.md`
- Module contract spec: `docs/AI/MODULE_SPEC.md`


# Forgeon Fullstack Scaffold

Canonical monorepo scaffold focused on one stable stack:

- NestJS API
- React + Vite web
- Prisma + Postgres
- Docker runtime (always generated)
- Proxy preset: `caddy` (default), `nginx`, or `none`

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
npx create-forgeon@latest my-app --i18n true --proxy caddy
```

Local invocation:

```bash
pnpm create:forgeon -- my-app --i18n true --proxy caddy
```

## Add Modules

```bash
npx create-forgeon@latest add --list
npx create-forgeon@latest add jwt-auth --project ./my-app
```

## Docs

- Project docs index: `docs/README.md`
- Module contract spec: `docs/AI/MODULE_SPEC.md`


# Forgeon Fullstack Scaffold

Canonical monorepo scaffold for NestJS + frontend with shared packages, built-in docs, optional i18n (enabled by default), and default DB stack Prisma + Postgres.

## Quick Start (Dev)

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Start local Postgres (Docker):
   ```bash
   docker compose --env-file infra/docker/.env.example -f infra/docker/compose.yml up db -d
   ```
3. Run API + web in dev mode:
   ```bash
   pnpm dev
   ```
4. Open:
   - Web: `http://localhost:5173`
   - API health: `http://localhost:3000/api/health`

## Quick Start (Docker)

```bash
docker compose --env-file infra/docker/.env.example -f infra/docker/compose.yml up --build
```

Open `http://localhost:8080`.

## i18n Toggle

Set in env:
- `I18N_ENABLED=true|false`
- `I18N_DEFAULT_LANG=en`
- `I18N_FALLBACK_LANG=en`

When `I18N_ENABLED=false`, API runs without loading i18n module.

## Prisma In Docker Start

API container starts with:
1. `prisma migrate deploy`
2. `node apps/api/dist/main.js`

This keeps container startup production-like while still simple.


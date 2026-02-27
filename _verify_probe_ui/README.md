# Forgeon Fullstack Scaffold

Canonical monorepo scaffold for NestJS + frontend with shared packages and generated docs.

## Generated Preset
- Stack: `NestJS + React + Docker`
- Frontend: `React + Vite + TypeScript` (fixed)
- Database: `Prisma + PostgreSQL` (`db-prisma`: `enabled`)
- i18n: `enabled`
- Docker/infra: `enabled` (fixed)
- Reverse proxy: `caddy` (`caddy|nginx|none`)

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

### Proxy Preset: Caddy
- `/api/*` is proxied to `api:3000`.
- Static frontend build is served by Caddy.
- Main proxy config: `infra/caddy/Caddyfile`.
- Compose service wiring: `infra/docker/compose.yml` (`caddy` service).
- Safe to edit: host ports and env values in `infra/docker/.env.example`.
- Avoid renaming service hosts (`api`, `db`) unless you also update proxy/compose config.
- Recommended preset for local SSL/OAuth-style testing.

### Prisma In Container Start

API container starts with:
1. `pnpm --filter @forgeon/api prisma:migrate:deploy`
2. `node apps/api/dist/main.js`

## i18n Configuration

Environment keys:
- `I18N_DEFAULT_LANG=en`
- `I18N_FALLBACK_LANG=en`

Resources location: `resources/i18n`.
These dictionaries are shared by backend (`nestjs-i18n`) and frontend (`react-i18next`).
Default namespaces: `common`, `errors`, `validation`, `ui`, `notifications`, `meta`.

Packages:
- `@forgeon/i18n`
- `@forgeon/i18n-contracts`
- `@forgeon/i18n-web`
- `react-i18next`

Dictionary key validation:
- `pnpm i18n:check`

Locale/namespace contracts sync:
- `pnpm i18n:sync`

Translation key types generation (manual):
- `pnpm i18n:types`

Add a new language folder:
- `pnpm i18n:add uk`
- optional flags: `--copy-from=en` `--empty` `--force` `--no-sync`

You can apply i18n later with:
`npx create-forgeon@latest add i18n --project .`

## Error Handling (`core-errors`)

`@forgeon/core` includes a default global exception filter (`CoreExceptionFilter`).

Wiring:
- module import: `apps/api/src/app.module.ts` (`CoreErrorsModule`)
- global registration: `apps/api/src/main.ts` (`app.useGlobalFilters(app.get(CoreExceptionFilter))`)

Usage:
- throw standard Nest exceptions in services/controllers:
  - `throw new ConflictException('Email already exists')`
  - `throw new NotFoundException('Resource not found')`

Response envelope:

```json
{
  "error": {
    "code": "conflict",
    "message": "Email already exists",
    "status": 409,
    "details": [],
    "requestId": "optional",
    "timestamp": "2026-02-25T12:00:00.000Z"
  }
}
```

## Next Steps
- Backend entrypoint: `apps/api/src/main.ts`
- Frontend entrypoint: `apps/web/src/main.tsx`
- Project docs index: `docs/README.md`
- AI workflow docs: `docs/AI/*`
- Module contract spec: `docs/AI/MODULE_SPEC.md`

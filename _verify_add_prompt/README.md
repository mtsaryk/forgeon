# Forgeon Fullstack Scaffold

Canonical monorepo scaffold for NestJS + frontend with shared packages and generated docs.

## Generated Preset
- Stack: `NestJS + React + Docker`
- Frontend: `React + Vite + TypeScript` (fixed)
- Database: `Prisma + PostgreSQL` (`db-prisma`: `enabled`)
- i18n: `disabled`
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

## JWT Auth Module

The jwt-auth add-module provides:
- `@forgeon/auth-contracts` shared auth routes/types/error codes
- `@forgeon/auth-api` Nest auth module (`login`, `refresh`, `logout`, `me`)
- JWT guard + passport strategy
- auth probe endpoint: `GET /api/health/auth`

Current mode:
- refresh token persistence: disabled by default (stateless mode)
- to enable persistence later:
  1. install a DB module first (for now: `create-forgeon add db-prisma --project .`);
  2. run `pnpm forgeon:sync-integrations` to auto-wire pair integrations.

Default demo credentials:
- `AUTH_DEMO_EMAIL=demo@forgeon.local`
- `AUTH_DEMO_PASSWORD=forgeon-demo-password`

Default routes:
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Logger Module

The logger add-module provides:
- request id middleware (default header: `x-request-id`)
- HTTP access logs with method/path/status/duration/ip/requestId
- Nest logger integration via `app.useLogger(...)`

Configuration (env):
- `LOGGER_LEVEL=log` (`error|warn|log|debug|verbose`)
- `LOGGER_HTTP_ENABLED=true`
- `LOGGER_REQUEST_ID_HEADER=x-request-id`

Where to see logs:
- local dev: API terminal output
- Docker: `docker compose logs api`

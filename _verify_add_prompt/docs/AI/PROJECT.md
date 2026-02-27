# PROJECT

## What This Repository Is

A canonical fullstack monorepo scaffold intended to be reused as a project starter.

## Structure
- `apps/api` - NestJS backend
- `apps/web` - React frontend (`React + Vite + TypeScript`, fixed)
- `packages/core` - shared backend core package (`core-config`, `core-errors`, `core-validation`)
- `packages/db-prisma` - DB module (`DbPrismaModule`, Prisma service + config)
- `infra` - Docker Compose (always) + proxy preset (`caddy`)
- `docs` - documentation, AI prompts, and module spec contracts

## Run Modes

### Dev mode

```bash
pnpm install
pnpm dev
```

### Docker mode

```bash
docker compose --env-file infra/docker/.env.example -f infra/docker/compose.yml up --build
```

### Proxy Notes
- Active proxy preset: `caddy`
- Main proxy config: `infra/caddy/Caddyfile`
- Keep service names `api` and `db` stable unless you update compose and proxy config together.

### Error Handling

`core-errors` is enabled by default.
- `CoreErrorsModule` is imported in `apps/api/src/app.module.ts`.
- `CoreExceptionFilter` is registered globally in `apps/api/src/main.ts`.
- Controllers and services should throw standard Nest exceptions; envelope formatting is handled centrally.

## Change Boundaries
- Safe to change first: env files, host ports, and app code under `apps/*`.
- Change carefully: proxy config and docker service names because routing depends on them.

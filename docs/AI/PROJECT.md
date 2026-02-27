# PROJECT

## What This Repository Is

A canonical fullstack monorepo scaffold intended to be reused as a project starter.

## Structure

- `apps/api` - NestJS backend
- `apps/web` - React frontend (fixed stack)
- `packages/core` - shared backend core package (`core-config`, `core-errors`, `core-validation`)
- `packages/db-prisma` - optional DB module (default-on at scaffold; can be added later)
- `packages/i18n` - reusable nestjs-i18n integration package
- `infra` - Docker Compose + proxy preset (`caddy|nginx|none`)
- `resources/i18n` - translation dictionaries
- `docs` - documentation, AI prompts, and module contracts

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

If `db-prisma` is enabled, API uses Prisma and expects `DATABASE_URL` from env.
If `db-prisma` is disabled, project stays DB-neutral and you can add DB later via:

```bash
create-forgeon add db-prisma --project .
```

If proxy preset is `none`, API is directly available on `localhost:3000`.

## Error Handling

`core-errors` is enabled by default.

- `CoreErrorsModule` is imported in `apps/api/src/app.module.ts`.
- `CoreExceptionFilter` is registered globally in `apps/api/src/main.ts`.
- Throw standard Nest exceptions from controllers/services; the filter converts them to a stable envelope.

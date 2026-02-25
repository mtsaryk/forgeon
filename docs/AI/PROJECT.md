# PROJECT

## What This Repository Is

A canonical fullstack monorepo scaffold intended to be reused as a project starter.

## Structure

- `apps/api` - NestJS backend
- `apps/web` - React frontend (fixed stack)
- `packages/core` - shared backend core package with internal submodules (starting with `core-config`)
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

The API uses Prisma and expects `DATABASE_URL` from env.

If proxy preset is `none`, API is directly available on `localhost:3000`.

## Error Handling

`core-errors` is enabled by default.

- `CoreErrorsModule` is imported in `apps/api/src/app.module.ts`.
- `CoreExceptionFilter` is registered globally in `apps/api/src/main.ts`.
- Throw standard Nest exceptions from controllers/services; the filter converts them to a stable envelope.

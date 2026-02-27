# Logger

- Id: `logger`
- Category: `observability`
- Status: implemented

## Overview

Adds API logging primitives with a dedicated logger package.

Included parts:
- `@forgeon/logger` package
- request-id middleware (`x-request-id` by default)
- HTTP logging interceptor for request/response timing
- env-driven logger config (`LOGGER_LEVEL`, `LOGGER_HTTP_ENABLED`, `LOGGER_REQUEST_ID_HEADER`)

## Applied Scope

- Adds `packages/logger` workspace package
- Wires logger config schema into API `ConfigModule` validation/load
- Registers logger module in `AppModule`
- Enables Nest app logger and global HTTP logging interceptor in `main.ts`
- Updates API `predev` script to build logger package
- Updates API Docker build stages to include `@forgeon/logger`
- Adds logger env keys to `apps/api/.env.example` and `infra/docker/.env.example`
- Passes logger env keys through `infra/docker/compose.yml`

## Status

Implemented and applied by `create-forgeon add logger`.

# ROADMAP

This is a living plan. Scope and priorities may change.

## Current Foundation (Implemented)

- [x] Canonical scaffold: NestJS API + React web + Prisma/Postgres + Docker
- [x] Proxy preset selection: `caddy | nginx | none`
- [x] `@forgeon/core`:
  - [x] `core-config` (typed env config + validation)
  - [x] `core-errors` (global envelope + exception filter)
  - [x] `core-validation` (global validation pipe)
- [x] `@forgeon/db-prisma` as default-applied DB module
- [x] i18n add-module baseline:
  - [x] `@forgeon/i18n`, `@forgeon/i18n-contracts`, `@forgeon/i18n-web`
  - [x] shared dictionaries in `resources/i18n/*`
  - [x] tooling: `i18n:sync`, `i18n:check`, `i18n:types`, `i18n:add`
- [x] module diagnostics probes pattern (`/api/health/*` + web test buttons)

## Standards (Accepted)

- [x] `*-contracts` and `*-web` packages are ESM-first
- [x] API runtime modules use Node-oriented TS config
- [x] no cross-package imports via `/src/*`; only package entrypoints

## Updated Priority Backlog

### P0 (Immediate Must-Have)

- [ ] `logger`
  - [ ] canonical logger module
  - [ ] requestId / correlationId propagation
  - [ ] structured log conventions

- [ ] `openapi / swagger`
  - [ ] env toggle: `SWAGGER_ENABLED`
  - [ ] standard setup
  - [ ] bearer integration hook for jwt-auth
  - [ ] `/docs` route

- [x] `jwt-auth`
  - [x] module split: contracts/api
  - [x] access + refresh baseline
  - [x] guards/strategy integration
  - [x] DB-aware install behavior:
    - [x] auto-wire refresh token persistence for `db-prisma`
    - [x] red warning + stateless mode when DB is missing/unsupported
  - [ ] web package split (`auth-web`) on next iteration

- [ ] `rbac / permissions`
  - [ ] decorators: `@Roles()`, `@Permissions()`
  - [ ] guard + policy helper
  - [ ] contracts: `Role`, `Permission`
  - [ ] integration with jwt-auth claims

- [ ] `redis/queue foundation`
  - [ ] base Redis config/service
  - [ ] queue baseline (BullMQ or equivalent)
  - [ ] retry and dead-letter conventions

- [ ] `rate-limit`
  - [ ] Nest Throttler add-module
  - [ ] policies: route / user / ip
  - [ ] error code: `TOO_MANY_REQUESTS`
  - [ ] reverse-proxy-aware mode (`trust proxy`)

- [ ] `files` (upload + storage)
  - [ ] upload endpoints + DTO + guards
  - [ ] storage presets: local + S3-compatible (MinIO/R2)
  - [ ] MIME/size validation
  - [ ] optional image processing subpackage (`sharp`)
  - [ ] error codes: `UPLOAD_INVALID_TYPE`, `UPLOAD_TOO_LARGE`, `UPLOAD_QUOTA`

### P1 (Strongly Recommended)

- [ ] `testing baseline`
  - [ ] unit + e2e presets
  - [ ] test helpers for add-modules
  - [ ] smoke test template for generated project

- [ ] `CI quality gates`
  - [ ] `typecheck`, `lint`, `test`, docker build smoke
  - [ ] release gate checklist

- [ ] `cache` (Redis)
  - [ ] CacheModule preset
  - [ ] key naming conventions
  - [ ] shared wrapper/service

- [ ] `scheduler`
  - [ ] `@nestjs/schedule` integration
  - [ ] task template
  - [ ] optional distributed lock (Redis)

- [ ] `mail`
  - [ ] at least one provider preset (SMTP/Resend/SendGrid)
  - [ ] templates: verify email, reset password
  - [ ] optional outbox with queue

- [ ] workspace `eslint/prettier` config package

### P2 (Later)

- [ ] frontend `http-client` module
- [ ] frontend UI kit package
  - [ ] migrate reusable parts from `eso-dt` (when available)
  - [ ] extend missing primitives
- [ ] `realtime` (ws)
  - [ ] gateway baseline
  - [ ] jwt auth for ws
  - [ ] rooms + basic events
- [ ] `webhooks` module (subject to scope validation)
  - [ ] signed inbound verify (HMAC)
  - [ ] signed outbound sender
  - [ ] replay protection (timestamp/nonce)

## Execution Plan (3 Sprints)

### Sprint 1: Platform Baseline and Security Start

Scope:
- `logger`
- `openapi/swagger`
- `jwt-auth`
- `testing baseline`
- `CI quality gates`

Definition of Done:
- add-modules install cleanly via `create-forgeon add <module>`
- local dev (`pnpm dev`) and docker build both pass on fresh generated project
- each module has probe endpoint and web probe UI hook when applicable
- docs updated in both root and template docs

### Sprint 2: Authorization and Traffic Control

Scope:
- `rbac/permissions`
- `redis/queue foundation`
- `rate-limit`
- `files`
- `cache`

Definition of Done:
- claims/roles/permissions flow validated end-to-end (api + web contracts)
- rate-limit and files include standardized error codes and envelope mapping
- Redis-backed modules run in docker profile with documented env keys
- at least one e2e happy-path per module

### Sprint 3: Async Integrations and Frontend Foundation

Scope:
- `scheduler`
- `mail`
- workspace `eslint/prettier` config package
- frontend `http-client`

Definition of Done:
- queue/scheduler/mail basic scenarios work in local + docker
- frontend http-client consumes api contracts with typed errors
- lint/typecheck/test/build pass through CI gate preset
- docs include migration notes and extension points

## Explicit Dependencies and Order Constraints

- `rbac` depends on `jwt-auth`
- `rate-limit` should follow Redis/queue foundation for scalable mode
- `mail` should reuse queue foundation where possible
- `openapi` is most useful before/with `jwt-auth` and `http-client`
- `realtime` and `webhooks` stay post-MVP unless a concrete use-case appears

## i18n Policy For Add-Modules

- [ ] each add-module that introduces user-facing text defines its own namespace templates
- [ ] if i18n is already enabled, namespace files are added during module installation
- [ ] if module is installed first and i18n later, namespaces are merged during i18n installation

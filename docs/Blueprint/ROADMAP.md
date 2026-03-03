# ROADMAP

This is a living plan. Scope and priorities may change.

## Current Foundation (Implemented)

- [x] Canonical scaffold: NestJS API + React web + Docker (+ default-on `db-prisma` module)
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
- [x] module prerequisites should move to a capability-driven dependency doctrine
- [x] only two dependency classes are canonical:
  - [x] hard prerequisite
  - [x] optional integration
- [x] non-TTY dependency install is opt-in only:
  - [x] `--with-required`
  - [x] `--provider <capability>=<module>`

## Updated Priority Backlog

### P0 (Immediate Must-Have)

- [x] `logger`
  - [x] canonical logger module
  - [x] requestId / correlationId propagation
  - [x] structured log conventions

- [x] `openapi / swagger`
  - [x] env toggle: `SWAGGER_ENABLED`
  - [x] standard setup
  - [ ] bearer integration hook for jwt-auth
  - [x] `/docs` route

- [x] `jwt-auth`
  - [x] module split: contracts/api
  - [x] access + refresh baseline
  - [x] guards/strategy integration
  - [x] DB-aware install behavior:
    - [x] auto-wire refresh token persistence for `db-prisma`
    - [x] red warning + stateless mode when DB is missing/unsupported
  - [ ] web package split (`auth-web`) on next iteration

- [x] `rbac / permissions`
  - [x] decorators: `@Roles()`, `@Permissions()`
  - [x] guard + policy helper
  - [x] backend-only runtime package (`@forgeon/rbac`)
  - [x] integration with jwt-auth demo claims via pair sync

- [ ] `redis/queue foundation`
  - [ ] base Redis config/service
  - [ ] queue baseline (BullMQ or equivalent)
  - [ ] retry and dead-letter conventions

- [x] `rate-limit`
  - [x] Nest Throttler add-module
  - [x] baseline in-memory policy
  - [x] error code: `TOO_MANY_REQUESTS`
  - [x] reverse-proxy-aware mode (`trust proxy`)

- [ ] `files` (upload + storage)
  - [ ] `files v1` base module
    - [ ] DB-backed metadata record
    - [ ] local storage driver
    - [ ] upload endpoint + probe flow
    - [ ] MIME/size validation
  - [ ] future split already accepted:
    - [ ] `files-s3`
    - [ ] `files-access`
    - [ ] `files-quotas`
    - [ ] `files-image`
  - [ ] see `docs/Blueprint/FILES_DESIGN.md`
  - [ ] implement using `docs/Blueprint/DEPENDENCY_DOCTRINE.md`

### P1 (Strongly Recommended)

- [ ] dependency doctrine refactor for existing modules
  - [ ] add capability metadata to module definitions
  - [ ] refactor `create-forgeon add` prerequisite resolution
  - [ ] replace concrete-module prerequisite assumptions where possible
  - [ ] add non-TTY support for `--with-required` and `--provider`
  - [ ] standardize optional integration warnings

- [ ] `jwt-auth` persistence boundary refactor
  - [ ] move from `db-prisma` assumption to `db-adapter`
  - [ ] keep Prisma as the first provider implementation
  - [ ] make future DB providers pluggable through the same conceptual boundary

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

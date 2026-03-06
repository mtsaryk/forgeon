# Agents

This file is the primary context entrypoint for work in the Forgeon repository.

Read this first, then open the relevant detail doc under `docs/Blueprint/` only if the current task needs deeper implementation history.

## Purpose

- keep one compact, current operational context for the project
- avoid re-deriving architecture decisions from scattered internal docs
- preserve stable conventions for add-modules, integrations, and docs

Primary detail specs to consult when touching module installation behavior:

- `docs/Blueprint/DEPENDENCY_DOCTRINE.md`
- `docs/Blueprint/MODULE_SPEC.md`
- `docs/Blueprint/ARCHITECTURE.md`
- `docs/Blueprint/FILES_V2_PLAN.md` (for variants and staged files v2 decisions)

## Canonical Stack

- Monorepo: `pnpm` workspaces
- Backend: NestJS
- Frontend: React + Vite + TypeScript
- Runtime: Docker is always generated
- Proxy preset: `caddy` (default), `nginx`, or `none`
- Database: `db-prisma` add-module, default-on at scaffold time, removable only by generating with `--db-prisma false`

Current scaffold defaults:

- `db-prisma=true`
- `i18n=true`
- `proxy=caddy`

## Repository Layout

- `apps/api` - NestJS application
- `apps/web` - React diagnostics shell and starter UI
- `packages/*` - reusable runtime modules and shared packages
- `infra/*` - Docker Compose and proxy presets
- `resources/*` - shared static assets, especially i18n dictionaries
- `docs/*` - internal Forgeon-only documentation and planning context
- `docs/Blueprint/*` - detailed internal design and planning docs

## Documentation Policy

Accepted decision:

- `docs/` in the Forgeon repository is internal-only and exists for Forgeon development
- internal docs must not be treated as end-user project documentation
- generated projects should not rely on copying Forgeon internal `docs/*` as part of the default scaffold

Generated project documentation target shape:

- root `README.md` as the primary user-facing setup and usage document
- module-specific readme files generated and updated by add-modules under `modules/<module-id>/README.md`

This means:

- internal planning/design files stay in the Forgeon repository
- generated projects should not receive the current template `docs/*` payload
- the generator should move toward README-driven user documentation for scaffolded projects

## Core Engineering Principles

- keep the stack narrow and stable; avoid speculative framework branching
- use idempotent patching for every add-module
- avoid cross-module writes inside a module installer unless the change belongs to that module itself
- use integration sync rules for module-to-module wiring
- prefer modular env validation: core validates core env, each add-module validates only its own env
- keep generated projects buildable in both local dev and Docker
- use package entrypoints only; never import sibling packages through `/src/*`

## TypeScript and Package Conventions

- backend runtime packages use `tsconfig.base.node.json`
- frontend-consumed shared packages (`*-contracts`, `*-web`) are ESM-first and use `tsconfig.base.esm.json`
- `*-contracts` is the source of truth for shared routes, DTOs, constants, and error codes
- backend-only infrastructure/security modules may use a single runtime package when contracts/web layers add no value

## Core Runtime Conventions

### Config

- `@forgeon/core` owns base config loading and validation
- base config is Zod-validated and exposed through typed accessors
- core env keys:
  - `PORT` (default `3000`)
  - `API_PREFIX` (default `api`)
- i18n env keys are owned by the i18n module, not by core
- module-owned env is validated inside the owning package

### Validation

- backend DTO validation uses `class-validator`
- global validation pipe is centralized in `@forgeon/core`
- current defaults:
  - `whitelist: true`
  - `transform: true`
  - `validationError.target: false`
  - `validationError.value: false`
- validation error details should be structured:
  - `{ field?: string, message: string }[]`

### Error Envelope

`@forgeon/core` owns the global exception filter and the HTTP error envelope.

Stable shape:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "status": 400,
    "details": [],
    "requestId": "optional-correlation-id",
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

Rules:

- throw standard Nest exceptions in controllers/services
- the global filter normalizes them into this envelope
- keep envelope shape stable across modules

## Stable Routes and Diagnostics

Core routes:

- `GET /api/health`
- `GET /api/health/error`
- `GET /api/health/validation`

Module probes currently in use:

- `POST /api/health/db` (`db-prisma`)
- `GET /api/health/auth` (`jwt-auth`)
- `GET /api/health/rate-limit` (`rate-limit`)
- `GET /api/health/rbac` (`rbac`)
- `POST /api/health/files` (`files`)
- `GET /api/health/files-variants` (`files` variants capability)
- `GET /api/health/files-access` (`files-access`)
- `GET /api/health/files-quotas` (`files-quotas`)
- `GET /api/health/files-image` (`files-image`)

API docs:

- Swagger UI: `GET /api/docs`
- Through proxy:
  - `http://localhost:8080/api/docs` when proxy is enabled

Web diagnostics page:

- default web app is a module probe shell
- feature probes append:
  - a new action button at the end of `<div className="actions">`
  - a new result block before the `networkError` block

## Add-Module Rules

Every add-module must be:

- idempotent on repeated install
- safe to apply after any supported module order
- explicit about new dependencies and follow-up steps
- documented in root README and in a dedicated internal module note

If a module changes dependency manifests (`package.json` fields such as `dependencies`, `devDependencies`, `optionalDependencies`, `peerDependencies`, or `pnpm.onlyBuiltDependencies`):

- `create-forgeon add <module>` should print:
  - `Next: run pnpm install`

If a module can be verified safely at runtime:

- it must add an API probe
- it must add a web probe trigger and a visible result block

Dependency handling is governed by `docs/Blueprint/DEPENDENCY_DOCTRINE.md`.

Accepted rules:

- hard dependencies are modeled as capabilities, not concrete modules
- only two dependency classes exist:
  - hard prerequisite
  - optional integration
- hard prerequisites:
  - in TTY: use explicit interactive resolution
  - in non-TTY: fail unless `--with-required` is provided
- non-TTY provider selection is explicit via:
  - `--provider <capability>=<module>`
- silent auto-install is forbidden
- optional integrations never block installation and must be presented as explicit follow-up opportunities

Current implementation status:

- `create-forgeon add` already supports:
  - `--with-required`
  - `--provider <capability>=<module>`
- module metadata now supports:
  - `provides`
  - `requires`
  - `optionalIntegrations`
- existing modules still need a follow-up pass to migrate provider-specific assumptions to capability-first rules where applicable

## Integration Sync Strategy

Cross-module patching belongs to sync rules, not to individual module installers.

Project command:

- `pnpm forgeon:sync-integrations`

Current workflow:

- `create-forgeon add <module>` installs only that module
- after install, the CLI scans only integration groups relevant to the added module
- if no relevant pending groups exist, it reports that and exits
- if relevant pending groups exist:
  - the CLI presents the groups
  - shows what each integration will change
  - lets the user apply one or all pending relevant integrations

Current integration groups:

1. `auth-persistence`
- conceptual boundary: `jwt-auth` + `db-adapter`
- current concrete provider: `db-prisma`
- integration descriptors now separate:
  - semantic participants: `jwt-auth`, `db-adapter`
  - concrete trigger modules: `jwt-auth`, `db-prisma`
- sync implementation now uses a provider-strategy dispatcher at the `db-adapter` boundary
- new DB providers should extend the strategy list instead of changing jwt-auth semantics
- current effect:
  - patch `AppModule` to wire `AUTH_REFRESH_TOKEN_STORE` to `PrismaAuthRefreshTokenStore`
  - add `apps/api/src/auth/prisma-auth-refresh-token.store.ts`
  - extend Prisma `User` with `refreshTokenHash`
  - add migration `0002_auth_refresh_token_hash`
  - update JWT auth README note

2. `auth-rbac-claims`
- modules: `jwt-auth`, `rbac`
- current effect:
  - extend `AuthUser` with optional `permissions`
  - add demo RBAC claims to JWT auth demo user and token payloads
  - expose `permissions` in refresh and `/me` responses
  - update JWT auth README note

Important rules:

- do not auto-patch Swagger decorators into other modules
- do not rely on hidden cross-module mutations inside `add <module>`
- if a new module needs cross-module behavior, add a sync rule instead
- when a capability boundary exists, refactor sync logic toward that capability instead of hard-coding one provider

## Implemented Modules

Implemented add-modules in `packages/create-forgeon/src/modules/registry.mjs`:

- `db-prisma`
  - package: `@forgeon/db-prisma`
  - default-applied at scaffold time unless disabled
  - adds Prisma/Postgres wiring, env config, scripts, Docker DB service, and DB probe

- `i18n`
  - packages:
    - `@forgeon/i18n`
    - `@forgeon/i18n-contracts`
    - `@forgeon/i18n-web`
  - adds backend/frontend i18n wiring and shared dictionaries in `resources/i18n/*`
  - installs independently as a multi-package module
  - includes tooling:
    - `pnpm i18n:sync`
    - `pnpm i18n:check`
    - `pnpm i18n:types`
    - `pnpm i18n:add <locale>`

- `logger`
  - package: `@forgeon/logger`
  - adds structured API logging, request IDs, and HTTP request logging
  - logs to stdout/stderr; file logging is intentionally out of scope
  - no dedicated probe is added; operational verification through logs is the accepted exception

- `swagger`
  - package: `@forgeon/swagger`
  - enables OpenAPI docs with env toggle
  - current route: `/api/docs`
  - feature-level Swagger decorators are intentionally manual
  - bearer integration hooks are still pending

- `jwt-auth`
  - packages:
    - `@forgeon/auth-contracts`
    - `@forgeon/auth-api`
  - baseline routes:
    - `POST /api/auth/login`
    - `POST /api/auth/refresh`
    - `POST /api/auth/logout`
    - `GET /api/auth/me`
    - `GET /api/health/auth`
  - by itself it installs auth cleanly
  - persistence is not baked into module install; DB-backed refresh storage is wired through sync integrations at the `db-adapter` boundary
  - current persistence provider implementation: `db-prisma`

- `rate-limit`
  - package: `@forgeon/rate-limit`
  - adds request throttling with env-driven defaults
  - installs independently; no optional integration sync is required in the current scaffold
  - env keys:
    - `THROTTLE_ENABLED`
    - `THROTTLE_TTL`
    - `THROTTLE_LIMIT`
    - `THROTTLE_TRUST_PROXY`
  - standardized over-limit error code: `TOO_MANY_REQUESTS`

- `rbac`
  - package: `@forgeon/rbac`
  - adds:
    - `@Roles(...)`
    - `@Permissions(...)`
    - `ForgeonRbacGuard`
  - protects routes through explicit Nest guard wiring
  - resource-level authorization remains domain logic; RBAC is coarse-grained access control

- `files`
  - package: `@forgeon/files`
  - DB-backed file metadata + upload/download/delete runtime
  - dedup v1:
    - `FileBlob` unique key: `hash + size + mimeType + storageDriver`
    - applies to both `original` and `preview` variants
    - unique-race hardening prevents orphan storage writes
  - download supports variant selection:
    - `GET /api/files/:publicId/download?variant=original|preview`
  - requires:
    - `db-adapter` capability
    - `files-storage-adapter` capability
  - probe:
    - `POST /api/health/files`
    - `GET /api/health/files-variants`

- `files-local`
  - package: `@forgeon/files-local`
  - local provider for `files-storage-adapter`
  - Docker volume:
    - `files_data` mounted to `/app/storage`

- `files-s3`
  - package: `@forgeon/files-s3`
  - S3-compatible provider for `files-storage-adapter`
  - runtime path in files service is active when `FILES_STORAGE_DRIVER=s3`
  - provider presets:
    - `minio` (default), `r2`, `aws`, `custom`
  - tuning:
    - `FILES_S3_MAX_ATTEMPTS`

- `files-access`
  - package: `@forgeon/files-access`
  - requires `files-runtime` capability
  - enforces resource-level checks for file metadata/download/delete
  - probe:
    - `GET /api/health/files-access`

- `files-quotas`
  - package: `@forgeon/files-quotas`
  - requires `files-runtime` capability
  - enforces owner-level upload quotas before write
  - probe:
    - `GET /api/health/files-quotas`

- `files-image`
  - package: `@forgeon/files-image`
  - requires `files-runtime` capability
  - enforces image magic-bytes validation + sanitize/re-encode before storage
  - default:
    - metadata stripping enabled
  - probe:
    - `GET /api/health/files-image`

Planned but not implemented:

- `queue`

## Current Auth and Access Decisions

- JWT auth and RBAC remain explicit
- route protection should use:
  - `@UseGuards(JwtAuthGuard, ForgeonRbacGuard)`
  - plus `@Roles(...)` and/or `@Permissions(...)`
- decorators alone do not enforce access; they only attach metadata
- `ForgeonRbacGuard` is required to evaluate that metadata
- RBAC does not replace resource ownership checks or per-resource domain authorization

## i18n Decisions

- i18n is an add-module, not core
- default generated locale set is currently English-only
- shared dictionaries live under `resources/i18n/<locale>/*.json`
- i18n helper commands:
  - `pnpm i18n:add <locale>`
  - `pnpm i18n:sync`
  - `pnpm i18n:check`
  - `pnpm i18n:types`

Known deferred idea:

- strict runtime fallback language check on web remains deferred

## Docker and Build Notes

- Docker is part of the canonical scaffold
- `db-prisma` owns DB service wiring in `infra/docker/compose.yml`
- API container runs Prisma migrations on startup, not in `postinstall`
- root `postinstall` created by `db-prisma` runs Prisma client generation after `pnpm install`
- if a module is added and dependency manifests changed, run `pnpm install` before `pnpm dev` or `pnpm docker:up`

## Files Module Family (Accepted Design)

`files` is the next major module family and should be treated as a multi-stage design, not a single monolith.

### Accepted Module Split

1. `files`
- base upload/download/delete primitives
- metadata persistence
- storage abstraction
- local storage driver

2. `files-s3`
- S3-compatible storage adapter
- intended to support AWS S3, Cloudflare R2, MinIO, and similar providers through config

3. `files-access`
- resource-level authorization for file operations
- ownership / visibility / group / tenant logic
- integrates with `jwt-auth` and `rbac`, but remains a separate policy layer

4. `files-quotas`
- file count and byte usage limits
- policy per user / group / tenant
- upload allowance checks before storage writes

5. `files-image`
- optional image processing
- thumbnails / resize / format conversion
- likely based on `sharp`

### `files v1` Scope

`files v1` should include only:

- upload endpoint(s)
- DB-backed file metadata record
- local storage only
- stable file IDs
- MIME and file-size validation
- a safe probe/demo flow

Excluded from `files v1`:

- advanced access-control
- quotas
- S3-compatible providers
- image transforms
- signed URLs

### Core `files` Design Rules

- metadata-first design; do not return raw storage paths as the source of truth
- every upload creates a metadata record
- storage adapter handles bytes only
- authorization and quotas stay outside the storage adapter
- storage abstraction must exist in v1 even if only local storage is implemented

### Canonical Metadata Shape

The exact schema may evolve, but the stable conceptual shape should include:

- `id`
- `storageKey`
- `originalName`
- `mimeType`
- `size`
- `ownerType`
- `ownerId`
- `visibility`
- `createdBy`
- `createdAt`
- `updatedAt`

### Canonical Upload Flow

1. receive request
2. validate file presence, MIME, and size
3. build metadata draft
4. write bytes through a storage adapter
5. persist metadata record
6. return a file DTO

### `files-access` Rule

- `rbac` is only coarse-grained authorization
- `files-access` must decide access to a specific file using:
  - metadata
  - authenticated user
  - ownership
  - group / tenant context
  - visibility rules

### `files-quotas` Rule

- quotas should be a separate policy layer
- maintain usage counters; do not recalculate from raw storage on every request
- expected future counters:
  - `subjectType`
  - `subjectId`
  - `bytesUsed`
  - `filesCount`

### Recommended Build Order

1. `files`
2. `files-s3`
3. `files-access`
4. `files-quotas`
5. `files-image`

### Current Implementation Snapshot

Runtime stage is now present:

- `files` add-module provides:
  - upload endpoint
  - metadata endpoint
  - download endpoint
  - delete endpoint
  - health probe wiring
  - Prisma `FileRecord` schema + migration template
- `files-local` add-module is the default provider for `files-storage-adapter`
  - Docker named volume `files_data` mounted to `/app/storage` for persisted local storage in container runs
- `files-s3` add-module provides S3-compatible runtime storage path for `files` (`FILES_STORAGE_DRIVER=s3`)

### Current Dependency Behavior (`create-forgeon add`)

- `files` requires:
  - `db-adapter`
  - `files-storage-adapter`
- interactive mode:
  - prompts for missing providers
  - for `files-storage-adapter`, `files-local` is first and marked recommended
- non-interactive mode:
  - requires `--with-required`
  - and for ambiguous providers requires `--provider`, for example:
    - `--provider files-storage-adapter=files-local`

### Current Recommendation

- build `files v1` as DB-backed
- require capability `db-adapter` for the canonical path
- prefer `db-prisma` first
- prefer `files-local` as the default files storage provider
- if no DB exists, the module should warn and refuse canonical install unless an explicit reduced mode is designed later
- follow `docs/Blueprint/FILES_V2_PLAN.md` for variants rollout and migration shape

## TODO / Next Steps

Immediate next engineering targets:

1. Decide and lock `FileRecord` schema v1 (with migration strategy notes)
2. Continue files-family modules:
   - `files-access`
   - `files-quotas`
   - `files-image`
   - harden `files-s3` behavior (error handling, optional signed URL flow)
3. Design files persistence integration-sync strategy at `db-adapter` boundary (provider-dispatch model, Prisma first strategy)
4. Start `files v2` implementation from `docs/Blueprint/FILES_V2_PLAN.md`:
   - lock `FileVariant` schema
   - add `variant` query support on download route
   - implement sync-first `preview` variant path for `files-image`
5. After files-family runtime baseline, continue with:
   - `queue`
   - testing baseline
   - CI quality gates
   - cache
   - mail

Documentation follow-up:

6. Keep generated-project documentation README-driven (`README.md` + `modules/<module-id>/README.md`)
7. Add the future project-scoped agent context file once its format is defined
8. Refactor existing modules to the capability-driven dependency doctrine:
   - replace remaining concrete-module prerequisite assumptions
   - extend current metadata usage across all modules
   - standardize capability-based prerequisite handling where module logic is still provider-specific
9. Add new auth-persistence provider strategies as future DB adapters are implemented

## Staged Refactor Plan (Temporary)

This is a temporary execution plan for normalizing existing modules under the dependency doctrine and shared module standards.

Remove or collapse this section after the refactor series is complete.

1. [x] `db-prisma`
- make it the clean reference provider for capability `db-adapter`
- normalize metadata, docs wording, README notes, and tests

2. [x] `jwt-auth` + auth persistence integration
- move conceptual persistence boundary from `db-prisma` to `db-adapter`
- keep Prisma as the first concrete provider implementation

3. [x] `rbac`
- normalize metadata and optional integration behavior with `jwt-auth`
 - keep install fully independent; `jwt-auth` remains optional integration only

4. [x] `swagger`
- verify fully independent install behavior and remove any misleading assumptions

5. [x] `logger`
- normalize lightweight infrastructure-module structure and docs

6. [x] `i18n`
- normalize multi-package module structure, tooling docs, and install behavior

7. [x] `rate-limit`
- normalize metadata, docs, and probe behavior under the same doctrine

8. [x] integration-layer cleanup
- unify integration descriptors, warning output, and shared install behavior

## Internal Detail Docs

Use these only when the task needs more detail than this file:

- `docs/Blueprint/PROJECT.md`
- `docs/Blueprint/ARCHITECTURE.md`
- `docs/Blueprint/ROADMAP.md`
- `docs/Blueprint/FILES_DESIGN.md`
- `docs/Blueprint/FILES_V2_PLAN.md`
- `docs/Blueprint/DEPENDENCY_DOCTRINE.md`
- `docs/Blueprint/MODULE_SPEC.md`
- `docs/Blueprint/MODULE_CHECKS.md`
- `docs/Blueprint/VALIDATION.md`
- `docs/Blueprint/DOCKER_BUILD_GOTCHAS.md`
- `docs/Blueprint/IDEAS.md`
- `docs/Blueprint/TASKS.md`

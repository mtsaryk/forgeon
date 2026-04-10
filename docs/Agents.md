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
- `docs/Blueprint/SKILLS.md`
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

- `apps/api` - internal API development harness and scaffold substrate
- `apps/web` - internal web diagnostics harness and scaffold substrate
- `packages/*` - reusable runtime modules and shared packages
- `infra/*` - Docker Compose and proxy presets
- `resources/*` - shared static assets, especially i18n dictionaries
- `docs/*` - internal Forgeon-only documentation and planning context
- `docs/Blueprint/*` - detailed internal design and planning docs

## Documentation Policy

Accepted decision:

- `docs/` in the Forgeon repository is internal-only and exists for Forgeon development
- this root repository is an internal development workspace, not a generated-project user guide
- internal docs must not be treated as end-user project documentation
- generated projects should not rely on copying Forgeon internal `docs/*` as part of the default scaffold

Generated project documentation target shape:

- root `README.md` as the primary user-facing setup and usage document
- module-specific readme files generated and updated by add-modules under `modules/<module-id>/README.md`
- references to generated-project commands (for example `pnpm forgeon:sync-integrations`) refer to scaffolded projects unless stated otherwise

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

## Repo-Local Skills

Forgeon keeps repo-specific AI skills under:

- `.codex/skills/*`

These skills are internal Forgeon development tools, not generated project artifacts.

Current repo-local skills:

- `forgeon-task-orchestrator`
- `forgeon-module-implementer`
- `forgeon-capability-dependencies`
- `forgeon-integration-sync`
- `forgeon-nest-wiring`
- `forgeon-ts-module-boundaries`
- `forgeon-docker-build-triage`
- `forgeon-doc-consistency`
- `forgeon-probe-pattern`
- `forgeon-testing-matrix`

Skill architecture and workflow rules are defined in:

- `docs/Blueprint/SKILLS.md`

When a task would clearly benefit from a missing specialized skill, the planning phase may explicitly recommend creating or installing that skill before implementation.

Default recommendation for such gaps:

- suggest the skill during planning
- explain why current repo skills are insufficient
- do not silently switch to undocumented ad-hoc conventions

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
- `GET /api/health/auth` (`accounts`)
- `GET /api/health/rate-limit` (`rate-limit`)
- `GET /api/health/rbac` (`rbac`)
- `POST /api/health/files` (`files`)
- `GET /api/health/files-variants` (`files` variants capability)
- `GET /api/health/files-access` (`files-access`)
- `GET /api/health/files-quotas` (`files-quotas`)
- `GET /api/health/files-image` (`files-image`)
- `GET /api/health/queue` (`queue`)
- `GET /api/health/scheduler` (`scheduler`)

API docs:

- Swagger UI: `GET /api/docs`
- Through proxy:
  - `http://localhost:8080/api/docs` when proxy is enabled

Web diagnostics page:

- default web app exposes a stable probe surface through `apps/web/src/probes.ts` and `<div id="probes">`
- feature probes register structured probe definitions instead of patching JSX directly
- web probe wiring is optional and should be skipped when the project no longer keeps that surface

## Add-Module Rules

Every add-module must be:

- idempotent on repeated install
- safe to apply after any supported module order
- explicit about new dependencies and follow-up steps
- documented in the generated project's root README and in a generated module note
- aligned with repo-local skill workflow and docs consistency checks

If a module changes dependency manifests (`package.json` fields such as `dependencies`, `devDependencies`, `optionalDependencies`, `peerDependencies`, or `pnpm.onlyBuiltDependencies`):

- `create-forgeon add <module>` should print:
  - `Next: run pnpm install`

If a module can be verified safely at runtime:

- it should add an API probe when the project still exposes `apps/api/src/health/health.controller.ts`
- it should add a web probe definition when the project still exposes `apps/web/src/App.tsx` with `#probes`

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

## Runtime Interaction Model

Accepted runtime interaction rules:

- runtime DB code is Prisma-first while `db-prisma` is the only supported DB runtime
- explicit runtime port/provider boundaries are reserved for real replaceable seams
- optional runtime reactions may use internal domain events
- integration sync remains scaffold/install-time wiring only and must not become a runtime business-flow substitute
- internal domain events are planned as an optional add-module, not as a global scaffold flag
- required security or persistence guarantees must not be moved behind best-effort event subscribers

Current planned shape:

- add-module id: `internal-event-bus`
- install surface: `create-forgeon add internal-event-bus`
- initial scope: backend-only, internal-only, in-process event delivery
- future extensions may bridge the same conceptual boundary toward queue/outbox/realtime consumers

Pattern selection summary:

- base model for real replaceable technology boundaries: hexagonal-style ports/adapters
- default Nest wiring mechanism: custom providers + dynamic modules
- provider selection for storage/email/external-provider boundaries may use strategy-style resolution
- optional in-process runtime reactions may use domain events
- reliable async cross-module reactions may use integration events + outbox
- saga/process manager is reserved for genuinely complex multi-step workflows and is currently out of scope
- file/media transformation should prefer explicit pipeline stages; optional async jobs may be layered later

Preparatory refactors before `internal-event-bus`:

- no DB port-extraction work is planned while Forgeon ships one canonical DB runtime
- targeted review only where it buys a cleaner seam: narrow direct runtime imports such as `files-quotas -> files` or `scheduler -> queue`

## Agent Workflow

For feature implementation, refactors, and non-trivial bugfixes, the canonical workflow is:

1. reframe the user request into a precise technical task
2. read `docs/Agents.md` first
3. open only the relevant deep docs under `docs/Blueprint/*`
4. classify the work:
   - new module
   - module refactor
   - build/runtime bug
   - integration sync
   - doctrine/architecture/doc change
5. if module-related, determine module type:
   - `fullstack`
   - `backend-only`
   - `web-only`
6. identify:
   - must-have now
   - good-to-have in v1
   - explicitly deferred scope
7. if something is ambiguous, ask direct clarifying questions instead of guessing
8. if the task would benefit from an additional skill not yet available, recommend creating or installing it before coding
9. present a concrete implementation plan and wait for explicit approval before writing code
10. after implementation, run a documentation consistency sweep

For implementation updates during execution, keep progress visible and short.

For final summaries, always include:

- what was done
- what was intentionally deferred
- what was not verified
- next logical step

Current implementation status:

- `create-forgeon add` already supports:
  - `--with-required`
  - `--provider <capability>=<module>`
- module metadata now supports:
  - `provides`
  - `requires`
  - `optionalIntegrations`
- remaining doctrine follow-up should target only real hotspots where provider-specific assumptions still create extension debt

## Integration Sync Strategy

Cross-module patching belongs to sync rules, not to individual module installers.

Generated-project command:

- `pnpm forgeon:sync-integrations`
- this command belongs to scaffolded projects; the root development repo may expose a different script surface

Current workflow:

- `create-forgeon add <module>` installs only that module
- after install, the CLI scans only integration groups relevant to the added module
- if no relevant pending groups exist, it reports that and exits
- if relevant pending groups exist:
  - the CLI presents the groups
  - shows what each integration will change
  - lets the user apply one or all pending relevant integrations

Current integration groups:

1. ccounts-rbac
- modules: ccounts, bac
- current effect:
  - extend accounts auth claim types with optional oles and permissions
  - keep JWT payload typing ready for future RBAC claims providers
  - update the managed accounts README note without mutating the base accounts schema

Important rules:
- do not auto-patch Swagger decorators into other modules
- do not rely on hidden cross-module mutations inside `add <module>`
- if a new module needs cross-module behavior, add a sync rule instead
- when a capability boundary exists, refactor sync logic toward that capability instead of hard-coding one provider

## Documentation Consistency

After changes to modules, doctrine, architecture, routes, env keys, package names, or integration behavior, perform a docs drift check across:

- `docs/Agents.md`
- `docs/Blueprint/ARCHITECTURE.md`
- `docs/Blueprint/DEPENDENCY_DOCTRINE.md`
- `docs/Blueprint/MODULE_SPEC.md`
- `docs/Blueprint/ROADMAP.md`
- `docs/Blueprint/TASKS.md`
- related module notes and README sections

Typical drift examples:

- task removed from one doc but still marked as `not implemented` in another
- route/env/package name changed in code but not in docs
- doctrine updated in one file but contradicted elsewhere

Default action when drift is found:

- recommend updating docs now
- treat `yes` as the default recommendation

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

- `accounts`
  - packages:
    - `@forgeon/accounts-contracts`
    - `@forgeon/accounts-api`
  - baseline routes:
    - `POST /api/auth/login`
    - `POST /api/auth/refresh`
    - `POST /api/auth/logout`
    - `GET /api/auth/me`
    - `GET /api/health/auth`
  - installs as a DB-backed module with hard prerequisite `db-adapter`
  - runtime is Prisma-first through `@forgeon/db-prisma`
  - `accounts-rbac` is the only compatibility sync in this area

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
  - env ergonomics:
    - leave `FILES_S3_REGION`, `FILES_S3_ENDPOINT`, `FILES_S3_FORCE_PATH_STYLE` empty to use preset defaults

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

- `queue`
  - package: `@forgeon/queue`
  - Redis-backed queue foundation using BullMQ
  - probe:
    - `GET /api/health/queue`
  - env keys:
    - `QUEUE_ENABLED`
    - `QUEUE_REDIS_URL`
    - `QUEUE_PREFIX`
    - `QUEUE_DEFAULT_ATTEMPTS`
    - `QUEUE_DEFAULT_BACKOFF_MS`

- `scheduler`
  - package: `@forgeon/scheduler`
  - requires `queue-runtime` capability
  - cron orchestration layer built on `@nestjs/schedule`
  - probe:
    - `GET /api/health/scheduler`
  - env keys:
    - `SCHEDULER_ENABLED`
    - `SCHEDULER_TIMEZONE`
    - `SCHEDULER_HEARTBEAT_CRON`

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
- `queue` owns Redis service wiring in `infra/docker/compose.yml`
- API container runs Prisma migrations on startup, not in `postinstall`
- root `postinstall` created by `db-prisma` runs Prisma client generation after `pnpm install`
- if a module is added and dependency manifests changed, run `pnpm install` before `pnpm dev` or `pnpm docker:up`

## Queue and Redis Rationale

- Redis is used as the queue broker because it is simple to run in local/dev Docker and is the canonical backend for BullMQ.
- Queue runtime state (job payload, retries, delay/backoff bookkeeping) is externalized from API process memory, so API restarts do not erase queued work.
- This stage intentionally ships queue foundation only:
  - producer/runtime wiring
  - Redis connectivity/probe
  - no job execution worker yet (deferred to worker module).
- `scheduler` now owns cron orchestration on top of queue:
  - heartbeat cron registration
  - fixed-id enqueue pattern to avoid unbounded queue growth before worker support exists
  - no distributed lock/leader election yet.

## Files Module Family (Accepted Design)

`files` is the largest implemented module family and should continue to be treated as a staged design, not a single monolith.

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
- integrates with `accounts` and `rbac`, but remains a separate policy layer

4. `files-quotas`
- file count and byte usage limits
- policy per user / group / tenant
- upload allowance checks before storage writes

5. `files-image`
- optional image processing
- thumbnails / resize / format conversion
- likely based on `sharp`

### Current Files Scope

The current split is intentional:

- `files` keeps the base metadata-first runtime:
  - upload
  - metadata read
  - variant-aware download
  - delete
  - probe endpoints
- `files-local` and `files-s3` are provider modules for `files-storage-adapter`
- `files-access`, `files-quotas`, and `files-image` stay separate add-modules on top of the base runtime

This means:

- files is not a monolithic "do everything" module
- access-control, quota policy, image hardening, and provider-specific behavior remain opt-in layers
- future work should be justified by concrete product need, not by completeness-for-its-own-sake

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

1. keep internal docs and roadmap aligned with the implemented generator workflow and CI surface
2. continue only the highest-value platform additions next:
   - cache
   - realtime adapter
   - communications extensions only when a real channel/provider need appears
   - scheduler distributed lock when needed
3. keep new modules feature-first, not fullstack-by-default:
   - backend-only, web-only, or fullstack are all valid
   - use fullstack only when backend and web genuinely share a stable contract
4. if/when realtime work starts, keep it capability-driven:
   - capability: `realtime-adapter`
   - providers: `realtime-sse`, `realtime-ws`
   - backend publishes through a transport-agnostic event/channel boundary
   - web consumes through transport-agnostic hooks/client helpers

Files follow-up should be demand-driven, not automatic. If the files family is revisited, the highest-value open questions are:

- lock the long-term `FileRecord` schema/index shape
- keep files on the accepted Prisma-first runtime unless a second DB runtime becomes real
- decide whether signed URLs or deeper S3 hardening have real product demand
- continue variants work only if the next product surface truly needs it

Documentation follow-up:

5. keep generated-project documentation README-driven (`README.md` + `modules/<module-id>/README.md`)
6. add the future project-scoped agent context file once its format is defined
7. add new cross-module compatibility syncs only when new seams actually appear
8. continue capability-doctrine cleanup only where module logic still has meaningful provider-specific debt

## Staged Refactor Plan (Historical)

The previous staged refactor wave for implemented modules is complete enough for the current internal pre-`1.0.0` phase.

Keep this as historical context only; do not reopen it unless a specific module hotspot justifies new work.

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
- `docs/Blueprint/SKILLS.md`
- `docs/Blueprint/TASKS.md`






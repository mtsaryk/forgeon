# TASKS

## Feature Discovery Matrix

```text
Scan this monorepo and build a backend feature matrix by app/package.
Use only evidence from code and dependencies.
Output:
1) taxonomy by category
2) feature comparison table
3) common core
4) unique features
5) architectural inconsistencies
Include file references for every feature.
```

## Add Module Package

```text
Create a new reusable package under packages/ for <feature-name>.
Requirements:
- minimal API
- NestJS-compatible module
- docs in package README
- wire into apps/api conditionally via env flag
- keep backward compatibility
```

## Refactor Core

```text
Move shared backend logic from apps/api into packages/core.
Do not change behavior.
Update imports, package dependencies, and docs.
Run build checks and show changed files.
```

## Generate Preset

```text
Create or update create-forgeon preset flow:
- keep canonical stack fixed: NestJS + React + Prisma/Postgres + Docker
- allow proxy choice only: caddy/nginx/none
- update generated files and docs fragments
- update docs/Blueprint/ARCHITECTURE.md and docs/Blueprint/MODULE_SPEC.md when scope changes
```

## Add Fullstack Module

```text
Implement `create-forgeon add <module-id>` for a fullstack feature.
Requirements:
- split module into contracts/api/web packages
- contracts is source of truth for routes, DTOs, errors
- if feasible, add module probe hooks in API (`/api/health/*`) and web diagnostics UI
- if i18n is enabled, add module namespace files and wire them for both API and web
- add user-facing module note under modules/<module-id>/README.md
- follow docs/Blueprint/DEPENDENCY_DOCTRINE.md for prerequisites and optional integrations
- keep backward compatibility
```

## Refactor Module Dependency Handling

```text
Refactor existing and new add-modules to the capability-driven dependency doctrine.
Requirements:
- introduce module metadata for:
  - provides
  - requires
  - optionalIntegrations
- model hard prerequisites as capabilities instead of concrete modules where possible
- in TTY:
  - resolve missing capabilities interactively
  - show a concrete install plan
  - require explicit confirmation
- in non-TTY:
  - fail by default
  - allow explicit recursive prerequisite install only with `--with-required`
  - require explicit provider mapping with `--provider <capability>=<module>`
- for optional integrations:
  - print a yellow warning after install
  - list involved modules in cyan
  - explain what the integration enables
  - print exact follow-up commands
- keep all patching idempotent
- update internal docs when doctrine changes
```

## Continue JWT Auth Persistence Provider Boundary

```text
Continue extending the jwt-auth persistence integration after the move to a provider-strategy dispatcher at the `db-adapter` boundary.
Requirements:
- keep the `db-adapter` capability as the public conceptual boundary
- keep current Prisma behavior working as the first provider implementation
- add new provider strategies so future DB providers can plug in without redefining jwt-auth semantics
- preserve current explicit integration flow (`pnpm forgeon:sync-integrations`)
```

## Refactor Auth Persistence Sync To Provider Strategy Model

```text
Completed: the auth-persistence integration now uses provider-specific strategies behind one capability-level integration group.
Requirements:
- keep `auth-persistence` as one logical integration at the `db-adapter` boundary
- provider-specific strategy handlers exist (starting with `db-prisma`)
- a dispatcher selects the active DB adapter implementation
- keep current Prisma-backed behavior unchanged for users
- make future DB providers pluggable without changing jwt-auth semantics or user-facing docs
- preserve the explicit integration flow (`pnpm forgeon:sync-integrations`)
```

## Implement Files Runtime V1 On Adapter Foundations

```text
Implement runtime behavior for files on top of already-shipped foundation modules:
- files
- files-local
- files-s3

Requirements:
- keep dependency doctrine: `files` requires `db-adapter` + `files-storage-adapter`
- add DB-backed FileRecord model and migration strategy
- add upload endpoint(s) and initial DTO contracts
- implement local runtime adapter first (`files-local`)
- add probe hooks only after route surface is stable
- keep access control and quotas out of v1 core (separate modules later)
```

## Design Files Persistence Sync At DB-Adapter Boundary

```text
Prepare the first integration-sync design for files persistence against future DB providers.
Requirements:
- keep `db-adapter` as capability boundary
- avoid hard-coding persistence logic to `db-prisma` in files runtime semantics
- define strategy-dispatch model similar to auth-persistence:
  - provider-specific sync handlers
  - one conceptual files-persistence integration group
- keep current Prisma behavior as the first strategy implementation
- document extension path for future adapters (e.g. db-mongo)
```

## Implement Files V2 Variants

```text
Implement files v2 variant support based on docs/Blueprint/FILES_V2_PLAN.md.
Requirements:
- keep FileRecord backward-compatible
- add FileVariant model and migration
- serve variants through existing download route using variant query
- keep storage-provider-agnostic behavior (local/s3)
- keep files-image as optional transform layer
- preserve files-access checks and files-quotas accounting behavior
- keep all changes idempotent for create-forgeon add-module flow
```

## Deferred TODOs

- i18n runtime fallback env check (deferred):
  - add optional `VITE_I18N_FALLBACK_LANG` for web;
  - validate it against `I18N_LOCALES`;
  - behavior: throw in `dev`, warn+fallback in `build/prod`.


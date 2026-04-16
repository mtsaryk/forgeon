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

## Create Repo Skill

```text
Create or update a repo-local Forgeon skill under `.codex/skills/<skill-name>/`.
Requirements:
- repo-specific, not generic
- reference `docs/Agents.md` first
- keep SKILL.md concise and workflow-oriented
- avoid duplicating long internal docs; point to `docs/Blueprint/*` instead
- clearly define:
  - when to trigger
  - what it must do
  - what it must not do
  - which Forgeon docs to read first
```

## Run Docs Consistency Sweep

```text
Check internal Forgeon docs for drift after the recent changes.
Review:
- docs/Agents.md
- docs/Blueprint/ARCHITECTURE.md
- docs/Blueprint/DEPENDENCY_DOCTRINE.md
- docs/Blueprint/MODULE_SPEC.md
- docs/Blueprint/ROADMAP.md
- docs/Blueprint/TASKS.md
- related README/module notes
Output:
1. confirmed consistent items
2. contradictions / stale statements
3. exact files that should be updated now
4. suggested patch order
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
- classify the module explicitly as `fullstack`, `backend-only`, or `web-only`
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

## Adopt Prisma-First Runtime For DB-Backed Modules

```text
Keep DB-backed modules on the accepted Prisma-first runtime doctrine.
Requirements:
- keep the `db-adapter` capability as the public conceptual boundary
- use direct `PrismaService` access or small local `store` classes in runtime code
- add `mapper` files only when shape conversion is non-trivial
- do not introduce DB persistence ports/adapters before a second DB runtime is real
- keep storage/email/external-provider ports only where the boundary is real now
```

## Retire Legacy Auth Persistence Sync (Historical)

```text
Completed: the legacy auth persistence-sync plan was superseded by the accounts umbrella refactor.
Requirements:
- keep `accounts` hard-required on `db-adapter`
- keep `accounts-rbac` as the only current compatibility sync in this area
- add new compatibility syncs only for real cross-module seams
- do not reintroduce provider-strategy auth persistence into base accounts
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
- keep access control and quotas out of base `files` core (handled by separate extension modules)
```

## Keep Files On Prisma-First Runtime

```text
Maintain the accepted files runtime doctrine without reintroducing speculative DB abstraction.
Requirements:
- keep `db-adapter` as capability boundary
- keep runtime persistence inside `packages/files/src/files.store.ts`
- keep storage as the real adapter boundary (`files-local`, `files-s3`)
- avoid DB persistence sync or provider-dispatch work until a second DB runtime becomes real
- document the future major-version trigger for revisiting DB abstraction
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
- env ergonomics refactor (deferred):
  - revisit the split between `apps/api/.env*` and `infra/docker/.env*`;
  - stop treating `.env.example` as an active runtime input;
  - decide whether local and docker env should stay separate live files or gain an explicit shared/defaults layer;
  - keep the future design clear for backend-only vars, future web vars, and generated-project UX.









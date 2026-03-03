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

## Refactor JWT Auth Persistence Boundary

```text
Refactor jwt-auth persistence integration from a concrete DB module assumption to a capability boundary.
Requirements:
- replace the conceptual dependency `db-prisma` with `db-adapter`
- keep current Prisma behavior working during transition
- restructure sync logic so future DB providers can plug in without redefining jwt-auth semantics
- preserve current explicit integration flow (`pnpm forgeon:sync-integrations`)
```

## Deferred TODOs

- i18n runtime fallback env check (deferred):
  - add optional `VITE_I18N_FALLBACK_LANG` for web;
  - validate it against `I18N_LOCALES`;
  - behavior: throw in `dev`, warn+fallback in `build/prod`.


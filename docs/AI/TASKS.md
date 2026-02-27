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
- update docs/AI/ARCHITECTURE.md and docs/AI/MODULE_SPEC.md when scope changes
```

## Add Fullstack Module

```text
Implement `create-forgeon add <module-id>` for a fullstack feature.
Requirements:
- split module into contracts/api/web packages
- contracts is source of truth for routes, DTOs, errors
- if feasible, add module probe hooks in API (`/api/health/*`) and web diagnostics UI
- if i18n is enabled, add module namespace files and wire them for both API and web
- add docs note under docs/AI/MODULES/<module-id>.md
- keep backward compatibility
```

## Implement JWT Auth Module

```text
Implement `create-forgeon add jwt-auth` as an idempotent add-module.
Requirements:
- split into `@forgeon/auth-contracts` and `@forgeon/auth-api`
- include login/refresh/logout/me endpoints + jwt strategy/guard
- add auth probe hook (`GET /api/health/auth`) and web probe button
- detect available DB adapter during install:
  - if supported adapter is found, auto-wire refresh token persistence
  - if DB is missing/unsupported, print red warning and install stateless mode
- update root README in generated project with follow-up steps to enable persistence later
```

## Deferred TODOs

- i18n runtime fallback env check (deferred):
  - add optional `VITE_I18N_FALLBACK_LANG` for web;
  - validate it against `I18N_LOCALES`;
  - behavior: throw in `dev`, warn+fallback in `build/prod`.


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
- add docs note under docs/AI/MODULES/<module-id>.md
- keep backward compatibility
```


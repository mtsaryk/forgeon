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
Create a new preset flow for create-forgeon:
- add new flag(s)
- update interactive questions
- update generated files
- keep defaults: Prisma + Postgres, React + Vite + TS
- update docs/AI/ARCHITECTURE.md
```


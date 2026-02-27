# create-forgeon

CLI package for generating Forgeon fullstack monorepo projects.

> [!WARNING]
> **Pre-release package. Do not use in production before `1.0.0`.**
> The project is under active development: each patch can add changes and may introduce breaking regressions.
>
> ![warning](https://img.shields.io/badge/STATUS-PRE--RELEASE%20DO%20NOT%20USE-red)

## Usage

```bash
npx create-forgeon@latest my-app --i18n true --db-prisma true --proxy caddy
npx create-forgeon@latest my-app --db-prisma false --proxy caddy
```

If flags are omitted, the CLI asks interactive questions.
Project name stays text input; fixed-choice prompts use arrow-key selection (`Up/Down + Enter`).

```bash
npx create-forgeon@latest add --list
npx create-forgeon@latest add i18n --project ./my-app
npx create-forgeon@latest add jwt-auth --project ./my-app
```

```bash
cd my-app
pnpm forgeon:sync-integrations
```

## Notes

- Canonical runtime stack is fixed: NestJS + React + Docker.
- DB is module-driven: `db-prisma` is default-on and can be disabled at scaffold time.
- Reverse proxy options: `caddy` (default), `nginx`, `none`.
- `add i18n` is implemented and applies backend/frontend i18n wiring.
- `add jwt-auth` is implemented and auto-detects DB adapter support for refresh-token persistence.
- Integration sync is bundled by default and runs after `add` commands (best-effort).
- Planned modules write docs notes under `docs/AI/MODULES/`.

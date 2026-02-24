# create-forgeon

CLI package for generating Forgeon fullstack monorepo projects.

## Usage

```bash
npx create-forgeon@latest my-app --i18n true --proxy caddy
```

If flags are omitted, the CLI asks interactive questions.
Project name stays text input; fixed-choice prompts use arrow-key selection (`Up/Down + Enter`).

```bash
npx create-forgeon@latest add --list
npx create-forgeon@latest add i18n --project ./my-app
npx create-forgeon@latest add jwt-auth --project ./my-app
```

## Notes

- Canonical stack is fixed: NestJS + React + Prisma/Postgres + Docker.
- Reverse proxy options: `caddy` (default), `nginx`, `none`.
- `add i18n` is implemented and applies backend/frontend i18n wiring.
- Planned modules write docs notes under `docs/AI/MODULES/`.

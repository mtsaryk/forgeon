# Documentation Index

- `AI/PROJECT.md` - project overview and run modes
- `AI/ARCHITECTURE.md` - monorepo design and extension model
- `AI/ROADMAP.md` - implementation roadmap and feature priorities
- `AI/MODULE_SPEC.md` - fullstack module contract (`contracts/api/web`)
- `AI/MODULE_CHECKS.md` - required runtime probe hooks for modules
- `AI/VALIDATION.md` - DTO/env validation standards
- `AI/TASKS.md` - ready-to-use Codex prompts
- `AI/DOCKER_BUILD_GOTCHAS.md` - recurring Docker build failures and release gate

## i18n Language Workflow

Add a new language from existing namespaces:
- `pnpm i18n:add uk`

Useful follow-up commands:
- `pnpm i18n:sync`
- `pnpm i18n:check`

## DB Module Note

- `db-prisma` is a full add-module (default-on at scaffold).
- Generate DB-neutral project with `--db-prisma false`.
- Add DB later with `create-forgeon add db-prisma --project .`.

# Documentation Index

- `Agents.md` - primary agent context and current engineering decisions
- `Blueprint/PROJECT.md` - project overview and run modes
- `Blueprint/ARCHITECTURE.md` - monorepo design and extension model
- `Blueprint/ROADMAP.md` - implementation roadmap and feature priorities
- `Blueprint/IDEAS.md` - backlog of future ideas that are intentionally not implemented yet
- `Blueprint/FILES_DESIGN.md` - internal design plan for the files module family
- `Blueprint/MODULE_SPEC.md` - fullstack module contract (`contracts/api/web`)
- `Blueprint/MODULE_CHECKS.md` - required runtime probe hooks for modules
- `Blueprint/VALIDATION.md` - DTO/env validation standards
- `Blueprint/TASKS.md` - reusable implementation prompts
- `Blueprint/DOCKER_BUILD_GOTCHAS.md` - recurring Docker build failures and release gate

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

# Forgeon Repository

Internal development monorepo for Forgeon.

This repository is where Forgeon modules, generator flows, scaffold templates, docs fragments, and internal doctrine are developed. It is not the generated project itself, and its root command surface does not need to match the command surface of scaffolded projects.

## What Lives Here

- `packages/create-forgeon`
  - generator CLI
  - add-module flows
  - integration sync orchestration
  - scaffold templates and generated-doc fragments
- `packages/*`
  - runtime modules and shared packages developed in this repo
- `apps/api` and `apps/web`
  - internal development harness and scaffold substrate
- `docs/*`
  - internal Forgeon documentation only
- `resources/*`
  - shared assets used by runtime modules and generated projects

## Working On The Repo

Install dependencies:

```bash
pnpm install
```

Run the internal development harness:

```bash
pnpm dev
```

Build all workspace packages:

```bash
pnpm build
```

Run the internal Docker stack:

```bash
pnpm docker:up
```

## Testing The Generator

Create a local project from this workspace:

```bash
pnpm create:forgeon -- my-app --i18n true --db-prisma true --proxy caddy
pnpm create:forgeon -- my-app --db-prisma false --proxy none
```

Published CLI examples:

```bash
npx create-forgeon@latest my-app --i18n true --db-prisma true --proxy caddy
npx create-forgeon@latest add jwt-auth --project ./my-app
```

Generated projects have their own command surface. For example, `pnpm forgeon:sync-integrations` is a generated-project command provided by scaffolded project templates, not a root script of this development repo.

## Documentation Boundaries

- Root `docs/*` is internal-only Forgeon documentation.
- Generated project user docs are produced from:
  - `packages/create-forgeon/templates/docs-fragments/README/*`
  - `packages/create-forgeon/templates/module-fragments/*`
- Generated projects should expose user-facing docs through:
  - root `README.md`
  - `modules/<module-id>/README.md`

Start here for internal repo context:

- `docs/README.md`
- `docs/Agents.md`

## Notes

- Version alignment across packages is handled separately closer to release.
- The root repo may intentionally diverge from generated project output when it improves Forgeon development workflows.

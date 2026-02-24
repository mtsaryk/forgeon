# Docker Build Gotchas

## Purpose

Checklist of recurring Docker build failures in generated Forgeon projects and how to prevent them when changing templates.

## Recurring Failures

1. Web build cannot resolve i18n JSON files (`TS2307` in `apps/web/src/i18n.ts`)
- Symptom:
  - `Cannot find module '../../../resources/i18n/...json'`
- Root cause:
  - wrong relative path from `apps/web/src` to monorepo `resources/`
- Fix:
  - use `../../../resources/i18n/...` imports
- Prevention:
  - after i18n changes, generate a project and run `pnpm --dir <project> --filter @forgeon/web build`

2. Docker proxy image fails only with i18n enabled
- Symptom:
  - local build may pass, but `docker compose up --build` fails in proxy web-builder step
- Root cause:
  - `infra/docker/*proxy*.Dockerfile` did not copy `resources/` into build context for frontend compile
- Fix:
  - ensure i18n module patch adds `COPY resources resources` to proxy Dockerfile(s)
- Prevention:
  - verify generated `infra/docker/caddy.Dockerfile` and `infra/docker/nginx.Dockerfile` include this line when i18n is on

3. Workspace package exists, but runtime/build imports from `/src` break in bundled output
- Symptom:
  - runtime errors like `require is not defined` or unresolved exports
- Root cause:
  - importing `@forgeon/<pkg>/src/index` instead of package entrypoint
- Fix:
  - always import `@forgeon/<pkg>` (public entrypoint only)
- Prevention:
  - grep check before release: `rg "@forgeon/.+/src/index" packages/create-forgeon/templates -n`

## Release Gate (minimal)

Before publishing `create-forgeon`, run:

1. `node --test --test-isolation=none` in `packages/create-forgeon`
2. Generate test project with i18n + caddy
3. In generated project:
   - `pnpm install`
   - `pnpm i18n:check`
   - `pnpm --filter @forgeon/web build`
   - `docker compose --env-file infra/docker/.env.example -f infra/docker/compose.yml build`

If one step fails, do not release.

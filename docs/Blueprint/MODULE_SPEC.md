# MODULE SPEC

## Goal

Define one repeatable fullstack pattern for Forgeon add-modules.

Dependency handling rules are defined in `docs/Blueprint/DEPENDENCY_DOCTRINE.md`.

Most feature modules should be split into:

1. `@forgeon/<feature>-contracts`
2. `@forgeon/<feature>-api`
3. `@forgeon/<feature>-web`

Exception:

- backend-only infrastructure or security modules may use a single runtime package (`@forgeon/<feature>`) when shared contracts and a dedicated web package add no real value.

## 1) Contracts Package

Single source of truth shared by backend and frontend.

Must contain:

- DTO/request/response types
- route constants (`API.<feature>.*`)
- error codes (`<FEATURE>_*`)
- shared constants (header/cookie names)
- package entrypoint exports only (`@forgeon/<feature>-contracts`)

Should contain:

- zod schemas + inferred TS types

Build/runtime rules:

- ESM-first package (`"type": "module"`, `module: "ESNext"`)
- extends `tsconfig.base.esm.json`
- no NestJS or browser-only runtime dependencies
- no imports from sibling package `/src/*` paths

## 2) API Package

NestJS module integrating contracts into backend runtime.

Must contain:

- module/service/controller
- guards/strategies (if auth/security related)
- config keys
- minimal e2e test path
- integration with `@forgeon/core` errors/logging

## 3) Web Package

React integration layer for the same feature.

Must contain:

- provider/hooks/store
- route guard (if feature requires auth/access)
- API client helpers using contracts route constants/types
- token/header/cookie wiring where relevant

## Acceptance Criteria

- No duplicate route strings across api/web.
- No duplicate error-code enums across api/web.
- Contracts package can be imported from both sides without circular dependencies.
- Contracts package exports are stable from `dist/index` entrypoint.
- Generated project user-facing docs live in:
  - root `README.md`
  - `modules/<module-id>/README.md`
- Module docs must explain: why it exists, what it adds, how it works, how to use it, how to configure it, and current operational limits.
- If module behavior can be runtime-checked, it also includes API+Web probe hooks (see `docs/Blueprint/MODULE_CHECKS.md`).
- If i18n is enabled, module-specific namespaces must be created and wired for both API and web.
- If module is added before i18n, namespace templates must still be prepared and applied when i18n is installed later.
- Module integration with other modules must be represented as idempotent sync rules and runnable via `pnpm forgeon:sync-integrations`.
- `create-forgeon add <module-id>` may scan and offer relevant pending pair integrations, but it must not apply them silently.
- Pair integrations can be applied from the post-add prompt or later via `pnpm forgeon:sync-integrations`.
- Module prerequisites must be expressed as capabilities where possible, not concrete providers.
- Modules must not assume `db-prisma` is present unless the provider itself is intentionally hard-coded for a temporary stage.
- New module work should prefer `db-adapter` over `db-prisma` as the dependency boundary.
- Hard prerequisites must follow the accepted dependency doctrine:
  - TTY: interactive provider resolution + explicit plan
  - non-TTY: fail by default unless `--with-required` is provided
- Optional integrations must not block installation and should be surfaced as explicit post-install warnings with follow-up commands.

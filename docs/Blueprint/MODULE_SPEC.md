# MODULE SPEC

## Goal

Define repeatable reusable-module patterns for Forgeon add-modules.

Forgeon is a generator monorepo for reusable product features that recur across our projects. A module is not fullstack by default just because Forgeon can generate both backend and frontend projects.

Reusable features may be backend services, frontend product surfaces, or shared cross-runtime capabilities. Typical examples include validation, authentication, files, i18n, logging, themes, UI kits, or other reusable application services.

Dependency handling rules are defined in `docs/Blueprint/DEPENDENCY_DOCTRINE.md`.

Classify each new module explicitly as one of these shapes:

1. backend-only
2. web-only
3. fullstack

A fullstack module is the canonical choice only when backend and frontend implementations belong to the same feature and should share one stable contract.

In that case, split it into:

1. `@forgeon/<feature>-contracts`
2. `@forgeon/<feature>-api`
3. `@forgeon/<feature>-web`

Backend-only infrastructure or security modules may use a single runtime package when shared contracts and a dedicated web package add no real value.

Web-only modules may expose only frontend-facing packages when there is no meaningful backend/runtime counterpart.

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

## Architecture Pattern Matrix

Choose patterns by boundary type, not by fashion.

### Replaceable Technology Boundaries

Use for:

- storage providers
- email delivery providers
- external auth providers
- other boundaries where the underlying technology may change and provider choice is real now

Preferred model:

- hexagonal-style ports/adapters
- Nest custom providers and dynamic modules for runtime wiring
- strategy-style selection when multiple providers satisfy one capability

Rule:

- required technology dependencies must not be modeled as events

### Canonical DB Runtime

Use for:

- DB-backed backend modules while Forgeon ships one canonical DB implementation
- feature persistence where Prisma is the accepted runtime

Preferred model:

- direct `PrismaService` injection in simple services
- small `store` classes for repeated queries, transactions, or query-heavy logic
- `mapper` files only when the shape transformation is non-trivial

Rule:

- do not create DB persistence ports/adapters before a second DB runtime exists in the same release line

### Optional Runtime Reactions

Use for:

- notifications
- audit trails
- analytics hooks
- other fan-out reactions that are not required for the core transaction to be valid

Preferred model:

- internal domain events for in-process optional reactions

Rule:

- if the core business action is invalid without the reaction, it is not an optional event reaction

### Reliable Async Cross-Module Reactions

Use for:

- reactions that must survive retries, crashes, or process boundaries

Preferred model:

- integration events + outbox

Rule:

- do not introduce outbox complexity before reliability needs are real

### Complex Workflow Coordination

Preferred model:

- saga/process manager

Current Forgeon status:

- explicitly out of scope until a real workflow requires it

### File And Media Processing

Preferred model:

- explicit pipeline stages for transform flow
- optional async jobs layered later if needed

Rule:

- file/media transforms should not default to domain events when a deterministic pipeline is the clearer model

## Acceptance Criteria

- No duplicate route strings across api/web.
- No duplicate error-code enums across api/web.
- Contracts package can be imported from both sides without circular dependencies.
- Contracts package exports are stable from `dist/index` entrypoint.
- In generated projects, user-facing docs live in:
  - root `README.md`
  - `modules/<module-id>/README.md`
- Module docs must explain: why it exists, what it adds, how it works, how to use it, how to configure it, and current operational limits.
- If module behavior can be runtime-checked, it also includes API+Web probe hooks (see `docs/Blueprint/MODULE_CHECKS.md`).
- Infrastructure-only modules may explicitly skip probe hooks when operational verification is the correct check (for example, structured logging observed through stdout/stderr); this exception must be documented in both root and module README text.
- If i18n is enabled, module-specific namespaces must be created and wired for both API and web.
- If module is added before i18n, namespace templates must still be prepared and applied when i18n is installed later.
- In generated projects, module integration with other modules must be represented as idempotent sync rules and runnable via `pnpm forgeon:sync-integrations`.
- In generated projects, `create-forgeon add <module-id>` may scan and offer relevant pending pair integrations, but it must not apply them silently.
- In generated projects, pair integrations can be applied from the post-add prompt or later via `pnpm forgeon:sync-integrations`.
- Module prerequisites must be expressed as capabilities where possible, not concrete providers.
- Install-time prerequisites should prefer the `db-adapter` capability over a concrete provider.
- Runtime DB-backed modules may directly depend on `@forgeon/db-prisma` while it remains the only supported DB runtime.
- New module work should not create DB persistence ports/adapters before a second DB runtime is real.
- Hard prerequisites must follow the accepted dependency doctrine:
  - TTY: interactive provider resolution + explicit plan
  - non-TTY: fail by default unless `--with-required` is provided
- Optional integrations must not block installation and should be surfaced as explicit post-install warnings with follow-up commands.
- New module work should follow the architecture pattern matrix:
  - replaceable technology with real provider choice -> port + adapter
  - canonical DB runtime -> Prisma-first service/store
  - optional reaction -> domain event
  - reliable async reaction -> integration event + outbox
  - complex workflow -> saga/process manager
  - files/media -> pipeline

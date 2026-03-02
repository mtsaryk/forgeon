# IDEA BACKLOG

This file keeps future ideas that are intentionally not implemented yet.

The goal is to preserve useful design directions without mixing them into the current stable module set.

## Rules

- ideas listed here are optional, not committed roadmap items
- each idea should stay small, concrete, and implementation-focused
- if an idea is promoted to active work, move it into `ROADMAP.md` or a module-specific task

## Current Ideas

### RBAC decorator sugar helpers

Potential ergonomic wrappers for route protection:

- `@RequireRoles(...)`
- `@RequirePermissions(...)`

Intent:

- combine `@UseGuards(...)` with RBAC metadata in one explicit decorator
- reduce repetitive route boilerplate

Current decision:

- not implemented
- current canonical pattern remains explicit:
  - `@UseGuards(JwtAuthGuard, ForgeonRbacGuard)`
  - plus `@Roles(...)` and/or `@Permissions(...)`

Reason:

- explicit Nest guard wiring is easier to audit
- less hidden magic in generated code
- safer until the decorator API is fully standardized

### Frontend route-guard module for RBAC

Potential future module:

- separate frontend access-control helpers for route gating

Intent:

- keep backend RBAC runtime focused and minimal
- avoid mixing frontend route logic into the backend `rbac` module

Current decision:

- not part of `rbac`
- if needed later, it should be a separate module

### Generated project context file for AI agents

Potential future scaffold output:

- generate a compact project-context file in each generated project
- purpose: give coding agents a fast entrypoint for project structure, installed modules, routes, env keys, and integration links

Intent:

- preserve quick machine-readable or machine-friendly project context
- avoid copying Forgeon's internal `docs/*` tree into user projects
- keep generated project docs minimal for humans while still giving agents a fast orientation file

Possible shape:

- a single generated file near project root
- similar in purpose to `docs/Agents.md`, but project-scoped and user-safe
- should describe:
  - enabled modules
  - key routes
  - env keys
  - known integrations
  - important follow-up commands

Current decision:

- not implemented
- keep as a future generator task after the template docs removal work

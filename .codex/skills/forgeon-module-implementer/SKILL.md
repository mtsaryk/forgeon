---
name: forgeon-module-implementer
description: Use when implementing or refactoring a Forgeon add-module. Covers package layout, generator patching, probes, docs, tests, Docker/build touchpoints, and idempotent mixed-order behavior.
---

# Forgeon Module Implementer

Read in this order:

1. `../../../docs/Agents.md`
2. `../../../docs/Blueprint/MODULE_SPEC.md`
3. `../../../docs/Blueprint/DEPENDENCY_DOCTRINE.md`
4. `../../../docs/Blueprint/ARCHITECTURE.md`
5. `../../../docs/Blueprint/MODULE_CHECKS.md` when probes are relevant

## Use this skill when

- creating a new add-module
- splitting an existing feature into module packages
- moving a feature from base scaffold into an add-module
- refactoring a module to match Forgeon conventions

## First decisions

Classify the module:

- `fullstack`
- `backend-only`
- `web-only`

Then decide whether it should use:

- `contracts + api + web`
- a single runtime package

## Standard delivery checklist

- add or update template preset package(s)
- add or update module installer patcher in `packages/create-forgeon/src/modules`
- patch only the module's own wiring directly
- push cross-module behavior into integration sync rules
- add module-specific env schema and config wiring
- update Docker/build-order only when the module actually affects build/runtime
- add API probe + web probe when runtime verification is safe and meaningful
- update:
  - root `README.md`
  - `modules/<module-id>/README.md`
- add or update mixed-order and idempotency tests

## Canonical touchpoints

- `apps/api/src/app.module.ts`
- `apps/api/src/health/health.controller.ts`
- `apps/web/src/App.tsx`
- `apps/api/package.json`
- `apps/api/Dockerfile`
- `infra/docker/compose.yml`
- `.env.example`
- `packages/create-forgeon/src/modules/*.mjs`

## Must do

- reuse existing Forgeon patterns when they fit
- explain clearly if an existing pattern is not suitable
- keep generated projects valid in local dev and Docker

## Must not do

- do not import sibling packages through `/src/*`
- do not add silent cross-module mutations in the installer
- do not skip docs or tests for runtime-visible modules

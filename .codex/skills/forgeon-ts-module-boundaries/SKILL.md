---
name: forgeon-ts-module-boundaries
description: Use for Forgeon TypeScript and package-boundary issues: CJS vs ESM, package entrypoints, exports fields, ESM-only dependencies, native dependencies, and build-order between workspace packages.
---

# Forgeon TS Module Boundaries

Read:

1. `../../../docs/Agents.md`
2. `../../../docs/Blueprint/ARCHITECTURE.md`
3. `../../../docs/Blueprint/MODULE_SPEC.md`
4. `../../../docs/Blueprint/DOCKER_BUILD_GOTCHAS.md`

## Use this skill when

- a package has import/export/runtime issues
- Vite or Rollup reports missing named exports
- Node reports `No "exports" main defined`
- an ESM-only dependency is used from a Node/CJS runtime package
- native dependency behavior differs between local and Docker

## Classification rule

Determine first whether the package is:

- backend runtime package
- frontend-consumed shared package

Then apply the correct TS/module format policy.

## Core checks

- package entrypoint imports only; never `/src/*`
- `package.json` exports/main/types/type are coherent
- Node packages extend `tsconfig.base.node.json`
- frontend-consumed shared packages extend `tsconfig.base.esm.json`
- ESM-only deps in CJS runtime use a safe native dynamic import strategy
- native deps that need install/build scripts are reflected in `pnpm.onlyBuiltDependencies`
- build order in `predev` and Dockerfile matches dependency direction

## Must not do

- do not assume local build success means Docker runtime success
- do not paper over module-boundary errors with ad-hoc path imports

---
name: forgeon-testing-matrix
description: Use for Forgeon generator and module verification: mixed installation order tests, idempotency checks, capability-resolution flows, integration-sync behavior, and targeted build/runtime smoke coverage.
---

# Forgeon Testing Matrix

Read:

1. `../../../docs/Agents.md`
2. `../../../docs/Blueprint/DOCKER_BUILD_GOTCHAS.md`
3. `../../../docs/Blueprint/DEPENDENCY_DOCTRINE.md`
4. relevant module docs for the feature under test

## Use this skill when

- adding or refactoring module tests in `packages/create-forgeon/src/modules/executor.test.mjs`
- deciding what should be covered for a new add-module
- verifying mixed install order behavior
- verifying idempotent patching
- deciding whether Docker/build smoke is required for a change

## Canonical test categories

1. install success on a compatible scaffold
2. idempotent repeated add behavior
3. mixed-order installation behavior
4. hard prerequisite resolution behavior
5. optional integration scan/apply behavior
6. build-order and package wiring checks
7. runtime probe wiring checks
8. targeted Docker smoke when the change touches build/runtime-critical paths

## Minimum expectations for a new runtime-visible module

- module wiring assertions in generated files
- docs/readme assertions when user-facing text changes
- probe assertions if the module has runtime probes
- mixed-order coverage if module interacts with common modules
- Docker/build coverage if the module changes:
  - Dockerfile
  - compose
  - native dependencies
  - build sequence
  - proxy assets
  - package module format boundaries

## Canonical files to inspect

- `packages/create-forgeon/src/modules/executor.test.mjs`
- `packages/create-forgeon/src/modules/dependencies.test.mjs`
- generated `apps/api/package.json`
- generated `apps/api/Dockerfile`
- generated `infra/docker/compose.yml`

## Must do

- test the actual regression class, not just the happy path
- add assertions close to the real generated artifacts
- prefer targeted generator tests before expensive full smoke runs

## Must not do

- do not rely only on one installation order
- do not skip Docker-sensitive verification for changes that obviously affect Docker/runtime
- do not add brittle assertions on irrelevant formatting

---
name: forgeon-integration-sync
description: Use for Forgeon cross-module integration rules handled through pnpm forgeon:sync-integrations. Covers integration groups, provider-strategy dispatch, trigger modules, summaries, and idempotent cross-module patching.
---

# Forgeon Integration Sync

Read:

1. `../../../docs/Agents.md`
2. `../../../docs/Blueprint/ARCHITECTURE.md`
3. `../../../docs/Blueprint/DEPENDENCY_DOCTRINE.md`
4. relevant module docs

## Use this skill when

- adding a new integration group
- refactoring provider-specific sync into a capability boundary
- changing `pnpm forgeon:sync-integrations`
- moving cross-module behavior out of installers

## Canonical rules

- installers patch only their own module
- cross-module behavior belongs to sync rules
- one logical integration may have multiple provider strategies
- user must opt into applying pending integrations

## Implementation checklist

- define one stable integration id
- separate:
  - conceptual participants
  - concrete trigger modules
- document what the integration changes
- keep patches idempotent
- keep user messaging accurate

## Must not do

- do not hide integration changes inside `add <module>`
- do not auto-patch Swagger decorators into other modules
- do not leak provider-specific details into capability-level semantics

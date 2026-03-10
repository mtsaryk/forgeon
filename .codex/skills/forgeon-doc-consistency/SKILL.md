---
name: forgeon-doc-consistency
description: Use after Forgeon code, doctrine, architecture, module, or integration changes to detect stale or contradictory internal documentation and recommend updates across Agents.md, Blueprint docs, and related README/module notes.
---

# Forgeon Doc Consistency

Read:

1. `../../../docs/Agents.md`
2. `../../../docs/Blueprint/SKILLS.md`

Then inspect the docs most likely touched by the change:

- `../../../docs/Blueprint/ARCHITECTURE.md`
- `../../../docs/Blueprint/DEPENDENCY_DOCTRINE.md`
- `../../../docs/Blueprint/MODULE_SPEC.md`
- `../../../docs/Blueprint/ROADMAP.md`
- `../../../docs/Blueprint/TASKS.md`
- related README sections and module notes

## Use this skill when

- a module was implemented or refactored
- doctrine or architecture changed
- routes, env keys, package names, or module statuses changed
- an item was removed from one doc and may still exist elsewhere

## What to look for

- `not implemented` text that is no longer true
- stale TODOs after completion
- changed route/env/package names still referenced in docs
- doctrine stated differently across docs
- roadmap/status mismatch

## Expected output

1. confirmed consistent items
2. contradictions or stale statements
3. exact files to patch
4. recommended patch order

Default recommendation:

- update docs now

## Must not do

- do not update just one status file if the same decision is described elsewhere
- do not assume README drift is harmless; in Forgeon it often causes repeated future mistakes

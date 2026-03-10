---
name: forgeon-probe-pattern
description: Use for Forgeon module probe work: API health endpoints, web diagnostics buttons and result blocks, probe cleanup expectations, and consistent probe wiring across add-modules.
---

# Forgeon Probe Pattern

Read:

1. `../../../docs/Agents.md`
2. `../../../docs/Blueprint/MODULE_CHECKS.md`
3. `../../../docs/Blueprint/MODULE_SPEC.md`

## Use this skill when

- adding a runtime-checkable module probe
- updating `HealthController` probe routes
- updating the web diagnostics shell in `apps/web/src/App.tsx`
- normalizing probe response shape and UX
- deciding whether a module should have a probe at all

## Canonical rules

- if a module can be verified safely at runtime, add an API probe
- if an API probe exists, add a matching web diagnostics action and result block
- append new probe action buttons at the end of `<div className="actions">`
- insert new result blocks before the `networkError` block when possible
- probe logic must be idempotent and safe to run repeatedly
- if a probe creates state, it should also clean up after itself when practical

## Canonical touchpoints

- `apps/api/src/health/health.controller.ts`
- `apps/web/src/App.tsx`
- related runtime service package
- module README text explaining what the probe verifies

## When to skip probes

A module may skip a probe only when operational verification is the correct check instead of a dedicated API call.

Examples:

- structured logging observed through stdout/stderr
- infrastructure-only runtime where a synthetic probe would be misleading

If skipped, document the reason in root and module README text.

## Must do

- keep probe responses explicit and useful for debugging
- keep probe routes stable and predictable
- keep UI labels clear and module-specific

## Must not do

- do not add probes that mutate persistent state without cleanup
- do not add probes that require hidden setup the diagnostics shell cannot satisfy
- do not return vague success payloads that hide partial failure

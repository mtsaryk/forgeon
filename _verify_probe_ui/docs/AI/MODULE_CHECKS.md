# MODULE CHECKS

## Purpose

Define mandatory runtime verification hooks for Forgeon modules.

If a module can be validated through a safe API call, it must provide:

1. A probe endpoint in API (`/api/health/*`).
2. A probe trigger on default web page (`apps/web/src/App.tsx`).
3. A visible result block in UI with HTTP status and JSON body.

## Current Baseline Probes

- `core-errors`: `GET /api/health/error` (returns error envelope, expected `409`)
- `core-validation`: `GET /api/health/validation` without `value` (expected `400`)
- `db-prisma` (when installed): `POST /api/health/db` (creates probe user and returns it, expected `201`)

## Rules For Future Modules

- Probe path should be explicit and feature-scoped (`/api/health/<feature>`).
- Probe must be deterministic and documented (expected status + payload shape).
- If probe writes data, it must use clearly marked probe/test records.
- Probe should not require hidden setup beyond documented env/dependencies.
- `create-forgeon add <module>` must wire both API probe and web probe UI when feasible.
- Web probes must be inserted into the shared probe container markers in `apps/web/src/App.tsx`:
  - actions marker: `{/* forgeon:probes:actions:start/end */}`
  - results marker: `{/* forgeon:probes:results:start/end */}`

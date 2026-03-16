# MODULE CHECKS

## Purpose

Define mandatory runtime verification hooks for Forgeon modules.

If a module can be validated through a safe API call, it should provide:

1. A probe endpoint in API (`/api/health/*`) when the project still exposes `apps/api/src/health/health.controller.ts`.
2. A probe definition in `apps/web/src/probes.ts` when the project still exposes `apps/web/src/App.tsx` with a `<div id="probes">` container.
3. A visible probe card in UI with title, button, HTTP status, and JSON body.

## Current Baseline Probes

- `core-errors`: `GET /api/health/error` (returns error envelope, expected `409`)
- `core-validation`: `GET /api/health/validation` without `value` (expected `400`)
- `db-prisma` (when installed): `POST /api/health/db` (creates probe user and returns it, expected `201`)
- `jwt-auth`: `GET /api/health/auth` (returns token store mode and demo auth probe metadata)

## Rules For Future Modules

- Probe path should be explicit and feature-scoped (`/api/health/<feature>`).
- Probe must be deterministic and documented (expected status + payload shape).
- If probe writes data, it must use clearly marked probe/test records.
- Probe should not require hidden setup beyond documented env/dependencies.
- `create-forgeon add <module>` should wire API probe additions only when probes are enabled and the `HealthController` surface still exists.
- Web probe wiring should go through the shared probe registry in `apps/web/src/probes.ts`, not by patching JSX fragments in `App.tsx`.
- Web probe wiring should be skipped with a warning when `App.tsx` is missing or the `#probes` container was intentionally removed.
- Probe definitions must be inserted in canonical order through the shared generator helper, not by module install order.

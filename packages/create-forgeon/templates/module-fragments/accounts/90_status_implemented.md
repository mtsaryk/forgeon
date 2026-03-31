## Current State

Status: implemented.

Notes:
- `accounts` is a hard consumer of the `db-adapter` capability.
- The base accounts schema does not store RBAC roles or permissions.
- Email verification and password reset are routed through an internal email stub boundary until the public `emails` module is implemented.

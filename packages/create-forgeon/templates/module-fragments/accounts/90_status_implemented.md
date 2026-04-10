## Current State

Status: implemented.

Notes:
- `accounts` is a hard consumer of the `db-adapter` and `communications-runtime` capabilities.
- The base accounts schema does not store RBAC roles or permissions.
- Registration and password-reset request flows send best-effort communication intents through `CommunicationsService`.

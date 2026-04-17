## Current State

Status: implemented.

Notes:
- `accounts` is a hard consumer of the `db-adapter` capability only.
- The base accounts schema does not store RBAC roles or permissions.
- Delivery-assisted auth/account flows belong to the optional `accounts-communications` extension.

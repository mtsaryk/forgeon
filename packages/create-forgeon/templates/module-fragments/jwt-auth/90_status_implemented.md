## Current State

Status: implemented.

Notes:
- The persistence boundary is `db-adapter`, not a hard dependency on one concrete DB module.
- The current DB adapter implementation for auth persistence is `db-prisma`.
- If no DB adapter is installed, jwt-auth stays in stateless refresh mode and surfaces an optional integration warning.

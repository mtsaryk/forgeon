## What It Adds

- `@forgeon/rbac` runtime package
- `@Roles(...)` decorator
- `@Permissions(...)` decorator
- `ForgeonRbacGuard`
- helper utilities for role and permission checks
- a protected probe route: `GET /api/health/rbac`
- a frontend probe button that sends a valid permission header

This module is backend-first. It does not include frontend route guards. If frontend access-control helpers are needed later, they should live in a separate module.

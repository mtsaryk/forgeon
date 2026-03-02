## How It Works

Implementation details:

- decorators store required roles and permissions as Nest metadata
- `ForgeonRbacGuard` reads that metadata with `Reflector`
- the guard checks `request.user` first
- if no user payload is available, it can also read test headers:
  - `x-forgeon-roles`
  - `x-forgeon-permissions`

Decision rules in v1:

- roles: any required role is enough
- permissions: all required permissions must be present

Failure path:

- denied access throws `403`
- the existing Forgeon error envelope wraps it as `FORBIDDEN`

## Scope

Implemented scope:

1. Public installer surface:
   - single umbrella add-module: `accounts`
   - requires `db-adapter`
   - requires `communications-runtime`
2. Internal runtime split:
   - `@forgeon/accounts-contracts`
   - `@forgeon/accounts-api`
   - users core, auth core, auth-jwt, auth-password
3. API runtime:
   - `POST /api/auth/register`
   - `POST /api/auth/login`
   - `POST /api/auth/refresh`
   - `POST /api/auth/logout`
   - `GET /api/auth/me`
   - `POST /api/auth/change-password`
   - stub endpoints for verify-email and password reset confirmation
4. Users surface:
   - owner-scoped routes under `/api/users/:id`, `/api/users/:id/profile`, `/api/users/:id/settings`
   - `/users/me` is resolved through the same owner-scoped route surface
5. Persistence and security:
   - DB-backed `User`, `UserProfile`, `UserSettings`, `AuthIdentity`, `AuthCredential`, `AuthRefreshToken`
   - argon2 for password and refresh-token hashing
   - refresh token rotation + revoke with per-token storage rows
6. Module checks:
   - API probe endpoint: `GET /api/health/auth`
   - default web probe button + result block

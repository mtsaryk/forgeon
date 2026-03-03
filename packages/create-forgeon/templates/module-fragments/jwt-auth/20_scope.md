## Scope

Implemented scope:

1. Split into reusable packages:
   - `@forgeon/auth-contracts`
   - `@forgeon/auth-api`
2. API runtime:
   - JWT login/refresh/logout/me endpoints
   - `JwtStrategy` + `JwtAuthGuard`
   - `authConfig` + `authEnvSchema` wiring through root `ConfigModule` validator chain
3. DB behavior:
   - module install stays stateless by default
   - refresh token hash persistence is enabled later through the `db-adapter` capability via `pnpm forgeon:sync-integrations`
   - current DB adapter implementation for this integration is `db-prisma`
   - if no DB adapter is installed, the module stays stateless and prints an optional integration warning with follow-up commands
4. Module checks:
   - API probe endpoint: `GET /api/health/auth`
   - default web probe button + result block

## Applied Scope

- Adds `packages/swagger` workspace package
- Wires swagger env schema into API config load/validation
- Registers `ForgeonSwaggerModule` in API `AppModule`
- Calls `setupSwagger(...)` from API bootstrap (`main.ts`)
- Updates API package/deps/scripts for swagger package build
- Updates API Docker build to include `@forgeon/swagger`
- Adds swagger env keys to:
  - `apps/api/.env.example`
  - `infra/docker/.env.example`
  - `infra/docker/compose.yml` (api service env passthrough)

Not included:

- no auto-patching of Swagger decorators into feature modules
- no implicit integration with `jwt-auth` or other add-modules

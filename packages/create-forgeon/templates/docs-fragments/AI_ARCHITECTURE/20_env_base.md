## Environment Flags

- `PORT` - API port (default 3000)
- `API_PREFIX` - global API prefix (default `api`)
- `DATABASE_URL` - DB connection string for Prisma

## Config Strategy

- `@forgeon/core` owns base runtime config (port, API prefix, node env).
- Core config is validated with Zod and exposed through typed accessors.
- Add-modules own and validate only their module-specific env keys.

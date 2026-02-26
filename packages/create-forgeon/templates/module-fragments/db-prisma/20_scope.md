## Applied Scope

- Adds `packages/db-prisma` workspace package
- Restores/creates `apps/api/prisma` schema and migrations
- Wires db config/env schema into API `ConfigModule` load/validation
- Registers `DbPrismaModule` in API `AppModule`
- Ensures `PrismaService` is available in health controller (`POST /api/health/db`)
- Updates API scripts and dependencies for Prisma workflows
- Updates API Docker build steps to include db package and prisma generate
- Ensures `DATABASE_URL` in:
  - `apps/api/.env.example`
  - `infra/docker/.env.example`
  - `infra/docker/compose.yml`


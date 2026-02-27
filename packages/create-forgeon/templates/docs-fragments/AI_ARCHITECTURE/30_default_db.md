## Default DB Stack

Current default stack is `{{DB_LABEL}}`.

- Prisma schema and migrations live in `apps/api/prisma`
- DB access is encapsulated via `DbPrismaModule` in `@forgeon/db-prisma`
- `db-prisma` is a full add-module and is enabled by default during scaffold generation (`db-prisma=true`).
- It can be disabled at generation time and added later via `create-forgeon add db-prisma --project .`.
- Additional DB presets are intentionally out of scope for the current milestone.

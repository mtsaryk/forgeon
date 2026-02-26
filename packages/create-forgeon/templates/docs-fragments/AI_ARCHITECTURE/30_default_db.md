## Default DB Stack

Current default stack is `{{DB_LABEL}}`.

- Prisma schema and migrations live in `apps/api/prisma`
- DB access is encapsulated via `DbPrismaModule` in `@forgeon/db-prisma`
- `db-prisma` is currently default-applied during scaffold generation.
- Future direction: this DB layer may be extracted into an explicit add-module/preset and optionally exposed via CLI flag(s).
- Additional DB presets are intentionally out of scope for the current milestone.

## Default DB Stack

Current default stack is `{{DB_LABEL}}`.

- Prisma schema and migrations live in `apps/api/prisma`
- DB access is encapsulated via `PrismaModule` (`apps/api/src/prisma`)
- Additional DB presets are intentionally out of scope for the current milestone.

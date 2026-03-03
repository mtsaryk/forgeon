## Overview

Adds the current Prisma/Postgres implementation of the `db-adapter` capability to the API.

Included parts:
- `@forgeon/db-prisma` package
- Prisma schema + migration files in `apps/api/prisma`
- API scripts for `prisma generate/migrate/studio/seed`
- DB health probe endpoint wiring

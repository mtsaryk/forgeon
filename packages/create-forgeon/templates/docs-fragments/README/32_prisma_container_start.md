### Prisma In Container Start

API container starts with:
1. `pnpm --filter @forgeon/api prisma:migrate:deploy`
2. `node apps/api/dist/main.js`

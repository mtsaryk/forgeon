## How To Use

Install:

```bash
npx create-forgeon@latest add rbac
pnpm install
```

Verify:

1. start the project
2. click `Check RBAC access` on the generated frontend
3. the request should return `200`

Manual forbidden-path check:

1. call `GET /api/health/rbac` without the `x-forgeon-permissions` header
2. the request should return `403`

Optional follow-up:

1. install `jwt-auth` if you want RBAC claims in demo JWT payloads
2. run `pnpm forgeon:sync-integrations`

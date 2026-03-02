## How To Use

Install:

```bash
npx create-forgeon@latest add rate-limit
pnpm install
```

Verify:

1. start the project
2. open the generated frontend
3. click `Check rate limit (click repeatedly)` multiple times within the throttle window
4. observe the transition from `200` to `429`

You can also hit the probe route directly:

```bash
GET /api/health/rate-limit
```

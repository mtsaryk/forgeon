## Scope

Current implementation includes:

1. Scheduler runtime package preset (`@forgeon/scheduler`) built on top of `@nestjs/schedule`.
2. API wiring in `AppModule` (config loader + env schema + scheduler module import).
3. Scheduler probe endpoint (`GET /api/health/scheduler`) and web probe button wiring.
4. Heartbeat cron registration that enqueues a fixed-id queue job without unbounded Redis growth.

## Scope

Current implementation includes:

1. Queue runtime package preset (`@forgeon/queue`) with Redis-backed BullMQ queue service.
2. API wiring in `AppModule` (config loader + env schema + queue module import).
3. Queue probe endpoint (`GET /api/health/queue`) and web probe button wiring.
4. Docker Compose Redis service + API queue env wiring.

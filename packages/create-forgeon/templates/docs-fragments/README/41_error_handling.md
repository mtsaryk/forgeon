## Error Handling (`core-errors`)

`@forgeon/core` includes a default global exception filter (`CoreExceptionFilter`).

Wiring:
- module import: `apps/api/src/app.module.ts` (`CoreErrorsModule`)
- global registration: `apps/api/src/main.ts` (`app.useGlobalFilters(app.get(CoreExceptionFilter))`)

Usage:
- throw standard Nest exceptions in services/controllers:
  - `throw new ConflictException('Email already exists')`
  - `throw new NotFoundException('Resource not found')`

Response envelope:

```json
{
  "error": {
    "code": "conflict",
    "message": "Email already exists",
    "status": 409,
    "details": [],
    "requestId": "optional",
    "timestamp": "2026-02-25T12:00:00.000Z"
  }
}
```

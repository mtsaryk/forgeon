### Error Handling

`core-errors` is enabled by default.

- `CoreErrorsModule` is imported in `apps/api/src/app.module.ts`.
- `CoreExceptionFilter` is registered globally in `apps/api/src/main.ts`.
- Controllers and services should throw standard Nest exceptions; envelope formatting is handled centrally.

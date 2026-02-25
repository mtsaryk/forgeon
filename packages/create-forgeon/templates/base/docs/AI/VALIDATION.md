# VALIDATION

## Backend DTO Validation Standard

- Use `class-validator` decorators on DTO classes.
- Global validation is done by Nest `ValidationPipe` with:
  - `whitelist: true`
  - `transform: true`
- Keep DTO validation messages stable and explicit.
- For required values, use a consistent key or message pattern.

## Config Validation Standard

- Use Zod for env/config validation.
- Core env is validated by `@forgeon/core` (`core-config`).
- Each add-module validates only its own env keys with its own Zod schema.
- Avoid one global env schema for all modules; keep schemas modular.

## Error Details for Validation

- Error envelope stays consistent:
  - `error.code`
  - `error.message`
  - `error.status`
  - optional `error.details`
- Validation details should be structured (not `any`).

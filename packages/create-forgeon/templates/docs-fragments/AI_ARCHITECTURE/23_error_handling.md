## Error Handling Strategy

- `@forgeon/core` owns the global HTTP error envelope.
- API apps import `CoreErrorsModule` and register `CoreExceptionFilter` as a global filter.
- Envelope fields:
  - `error.code`
  - `error.message`
  - `error.status`
  - `error.details` (optional, mainly validation context)
  - `error.requestId` (optional, derived from `x-request-id`)
  - `error.timestamp`

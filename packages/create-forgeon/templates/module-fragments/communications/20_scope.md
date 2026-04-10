## Scope

Implemented scope:

1. Public installer surface:
   - single add-module: `communications`
2. Runtime package:
   - `@forgeon/communications`
3. Core behavior:
   - `CommunicationsService` orchestration
   - file-based template loading from `resources/communications/*`
   - simple `$PLACEHOLDER$` rendering
4. Channel support:
   - email channel with Gmail SMTP transport configuration
   - sms stub channel
   - push stub channel
5. Module checks:
   - `GET /api/health/communications`
   - `POST /api/health/communications`
   - default web probe with email input + test send

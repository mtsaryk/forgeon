## Scope

Implemented scope:

1. Public installer surface:
   - single add-module: `accounts-communications`
   - requires `accounts`
   - requires `communications`
2. Runtime package:
   - `@forgeon/accounts-communications`
3. Handler rebinding:
   - pending-verification `register`
   - confirmable `change-password`
4. Extension routes:
   - `POST /api/auth/verify-email`
   - `POST /api/auth/password-reset/request`
   - `POST /api/auth/password-reset/confirm`
   - `POST /api/auth/change-password/confirm`
   - `POST /api/auth/change-email/request`
   - `POST /api/auth/change-email/confirm`
5. Runtime boundaries:
   - one `AuthCommunicationsController`
   - one `AuthCommunicationsService`
   - base account/auth state remains owned by `accounts`

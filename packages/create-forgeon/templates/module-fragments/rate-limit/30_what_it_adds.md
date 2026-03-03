## What It Adds

- `@forgeon/rate-limit` workspace package
- env-backed throttle configuration
- global Nest throttler guard wiring
- reverse-proxy trust toggle for Caddy / Nginx deployments
- `GET /api/health/rate-limit` probe endpoint
- frontend probe button on the generated home page

This module installs independently. In the current scaffold it does not depend on, or require sync with, any other add-module.

This module is API-first. It does not add shared contracts or a web package in v1 because the runtime value is in backend request throttling, not in reusable client-side types.

## Overview

Adds API logging primitives with a dedicated logger package.

Included parts:
- `@forgeon/logger` package
- request-id middleware (`x-request-id` by default)
- HTTP logging interceptor for request/response timing
- env-driven logger config (`LOGGER_LEVEL`, `LOGGER_HTTP_ENABLED`, `LOGGER_REQUEST_ID_HEADER`)

Important boundary:
- this module installs independently
- it intentionally does not add a dedicated runtime probe
- verification is done through API process logs

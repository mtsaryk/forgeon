## Overview

Adds OpenAPI docs support to the API.

Included parts:
- `@forgeon/swagger` package
- env-driven toggle (`SWAGGER_ENABLED`)
- configurable docs path/title/version
- `setupSwagger(...)` bootstrap helper

Important boundary:
- this module installs independently
- it wires only the OpenAPI runtime and bootstrap setup
- feature-specific Swagger decorators remain manual

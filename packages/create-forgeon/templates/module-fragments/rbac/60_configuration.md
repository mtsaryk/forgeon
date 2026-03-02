## Configuration

This module has no dedicated environment variables in v1.

Behavior is controlled by:

- route decorators (`@Roles`, `@Permissions`)
- the active request payload (`request.user`)
- optional testing headers (`x-forgeon-roles`, `x-forgeon-permissions`)
